"""Build an immutable, auditable snapshot using only the six supplied CSV files."""
import csv
import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
FILES = ['artists', 'releases', 'pageviews', 'artist_attention_summary', 'data_dictionary', 'data_dictionary_release']
SCHEMAS = {
    'artists': 'artist_mbid artist_name artist_type country disambiguation gender area tags aliases begin_date source_url collected_at'.split(),
    'releases': 'artist_mbid artist_name release_mbid release_title release_date release_country release_status release_packaging release_barcode release_disambiguation release_language media_count track_count source_url collected_at'.split(),
    'pageviews': 'artist_name wiki_title pageview_date pageviews source_url collected_at'.split(),
    'artist_attention_summary': 'artist_mbid artist_name artist_type gender country begin_year disambiguation top_tags source release_count first_release_year last_release_year total_pageviews median_daily_views pageview_days'.split(),
    'data_dictionary': 'column_name description data_type source nullable'.split(),
    'data_dictionary_release': 'table column description type'.split(),
}


def split_values(value):
    return list(dict.fromkeys(s.strip() for s in (value or '').split(';') if s.strip()))


def partial_date(value):
    if not value:
        return None, None, None, 'unknown'
    if not re.fullmatch(r'\d{4}(-\d{2})?(-\d{2})?', value):
        raise ValueError(f'Invalid partial date: {value}')
    parts = [int(p) for p in value.split('-')]
    date(parts[0], parts[1] if len(parts) > 1 else 1, parts[2] if len(parts) > 2 else 1)
    return (*parts, *([None] * (3-len(parts))), ['year', 'month', 'day'][len(parts)-1])


def safe_cell(value):
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')):
        return "'" + value
    return value


def write_csv(path, rows, fields=None):
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields or list(rows[0]) if rows else fields or [])
        writer.writeheader()
        writer.writerows({k: safe_cell(v) for k, v in r.items()} for r in rows)


def ingest(root=ROOT):
    raw, output = root / 'data/raw', root / 'data'
    cleaned = output / 'cleaned'
    cleaned.mkdir(parents=True, exist_ok=True)
    sources, manifest, schemas = {}, {}, {}
    for table in FILES:
        path = raw / f'{table}.csv'
        manifest[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            schemas[table] = reader.fieldnames
            if reader.fieldnames != SCHEMAS[table]:
                raise ValueError(f'Schema mismatch in {path.name}: {reader.fieldnames}')
            sources[table] = list(reader)
    quality = {'schemas': schemas, 'source_hashes': manifest, 'row_counts': {k: len(v) for k, v in sources.items()},
               'missingness': {k: {c: sum(not r[c] for r in rows) for c in schemas[k]} for k, rows in sources.items()}}
    artists = [{**{k: v or None for k, v in r.items()}, 'source_row': i, 'tags_list': split_values(r['tags']),
                'aliases_list': split_values(r['aliases'])} for i, r in enumerate(sources['artists'], 2)]
    ids = [a['artist_mbid'] for a in artists]
    if len(ids) != len(set(ids)) or None in ids:
        raise ValueError('Artist MBIDs must be nonempty and unique')
    exact, normalized = defaultdict(list), defaultdict(list)
    for a in artists:
        exact[a['artist_name']].append(a['artist_mbid'])
        normalized[unicodedata.normalize('NFKC', a['artist_name'])].append(a['artist_mbid'])
    observations, matches, seen = [], {}, set()
    for i, r in enumerate(sources['pageviews'], 2):
        name = r['artist_name']
        candidates = exact.get(name, [])
        method = 'exact'
        if not candidates:
            candidates = normalized.get(unicodedata.normalize('NFKC', name), [])
            method = 'unique NFKC'
        if len(candidates) != 1:
            raise ValueError(f'Unresolved pageview identity at source row {i}: {name}')
        mbid = candidates[0]
        matches[name] = {'artist_name': name, 'artist_mbid': mbid, 'method': method}
        if not re.fullmatch(r'\d{8}', r['pageview_date']) or not re.fullmatch(r'\d+', r['pageviews']):
            raise ValueError(f'Invalid observation at row {i}')
        day = datetime.strptime(r['pageview_date'], '%Y%m%d').date().isoformat()
        if (mbid, day) in seen:
            raise ValueError(f'Duplicate artist-day at row {i}')
        seen.add((mbid, day))
        observations.append({**r, 'artist_mbid': mbid, 'date': day, 'views': int(r['pageviews']), 'source_row': i, 'match_method': method})
    releases = []
    for i, r in enumerate(sources['releases'], 2):
        if r['artist_mbid'] not in ids:
            raise ValueError(f'Orphan release at row {i}')
        year, month, day, precision = partial_date(r['release_date'])
        releases.append({**{k: v or None for k, v in r.items()}, 'year': year, 'month': month, 'day': day,
                         'precision': precision, 'source_row': i, 'media_count': int(r['media_count']), 'track_count': int(r['track_count'])})
    release_ids = [r['release_mbid'] for r in releases]
    quality['duplicate_release_mbids'] = [k for k, n in Counter(release_ids).items() if n > 1]
    quality['identity_matches'] = list(matches.values())
    release_counts = Counter(r['artist_mbid'] for r in releases)
    quality['possibly_capped_artists'] = [a['artist_name'] for a in artists if release_counts[a['artist_mbid']] == 100]
    quality['all_track_counts_zero'] = all(r['track_count'] == 0 for r in releases)
    quality['dictionary_discrepancies'] = [r for r in sources['data_dictionary_release'] if r['column'] not in schemas.get(r['table'], [])]
    quality['dictionary_notes'] = ['begin_date is birth for a person or formation for a group, not career start.',
        'source_url in pageviews contains article slugs, not original API request URLs.',
        'The release dictionary declares English Wikipedia all-access user views; request settings cannot be independently verified.',
        'No collector code, raw API responses, artwork, release-group IDs, or dataset license were supplied.']
    summary = {r['artist_mbid']: r for r in sources['artist_attention_summary']}
    quality['summary_missing_artists'] = [a['artist_name'] for a in artists if a['artist_mbid'] not in summary]
    quality['summary_disagreements'] = []
    for a in artists:
        views = [p['views'] for p in observations if p['artist_mbid'] == a['artist_mbid']]
        ar = [r for r in releases if r['artist_mbid'] == a['artist_mbid']]
        years = [r['year'] for r in ar if r['year']]
        metrics = {'total_pageviews': sum(views), 'pageview_days': len(views), 'median_daily_views': median(views) if views else None,
                   'release_count': len(set(r['release_mbid'] for r in ar)), 'first_release_year': min(years) if years else None,
                   'last_release_year': max(years) if years else None}
        if a['artist_mbid'] in summary:
            for field, actual in metrics.items():
                supplied = summary[a['artist_mbid']][field]
                parsed = float(supplied) if supplied else None
                if actual != parsed:
                    quality['summary_disagreements'].append({'artist': a['artist_name'], 'field': field, 'supplied': supplied, 'recomputed': actual})
    quality['bounds'] = [min(p['date'] for p in observations), max(p['date'] for p in observations)]
    quality['total_views'] = sum(p['views'] for p in observations)
    quality['collected_at'] = sorted(set(r['collected_at'] for t in ['artists', 'releases', 'pageviews'] for r in sources[t]))
    quality['transformations'] = ['Original CSV bytes preserved; raw rows retained in database.', 'Blank metadata becomes null.',
        'Tags and aliases split on semicolons, trimmed, and deduplicated within artist.', 'Exact unique name joins; NFKC fallback only when unique.',
        'UTC YYYYMMDD dates parsed; nonnegative integer views validated; absent days remain absent.',
        'Partial release dates retain precision; barcodes remain strings.', 'Cleaned CSV cells are escaped against spreadsheet formula injection.']
    temp = output / 'snapshot.build.sqlite'
    if temp.exists():
        temp.unlink()
    with sqlite3.connect(temp) as db:
        db.execute('CREATE TABLE raw_rows (source TEXT, source_row INTEGER, raw_json TEXT, PRIMARY KEY(source, source_row))')
        for table, rows in sources.items():
            db.executemany('INSERT INTO raw_rows VALUES (?, ?, ?)', [(table, i, json.dumps(r, ensure_ascii=False)) for i, r in enumerate(rows, 2)])
        for table, rows in [('artists', artists), ('pageviews', observations), ('releases', releases)]:
            fields = list(rows[0])
            ints = {'source_row', 'views', 'year', 'month', 'day', 'media_count', 'track_count'}
            db.execute(f'CREATE TABLE {table} (' + ','.join(f'"{k}" ' + ('INTEGER' if k in ints else 'TEXT') for k in fields) + ')')
            db.executemany(f'INSERT INTO {table} VALUES (' + ','.join('?' for _ in fields) + ')',
                           [[json.dumps(v, ensure_ascii=False) if isinstance(v, list) else v for v in r.values()] for r in rows])
            write_csv(cleaned / f'{table}.csv', rows)
        db.execute('CREATE UNIQUE INDEX artist_id ON artists(artist_mbid)')
        db.execute('CREATE UNIQUE INDEX observation_day ON pageviews(artist_mbid, date)')
        db.execute('CREATE INDEX release_artist ON releases(artist_mbid)')
        db.execute('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)')
        db.execute('INSERT INTO metadata VALUES (?,?)', ('quality', json.dumps(quality, ensure_ascii=False)))
    db.close()
    temp.replace(output / 'snapshot.sqlite')
    for name, value in [('manifest', manifest), ('quality', quality)]:
        (output / f'{name}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return quality


if __name__ == '__main__':
    q = ingest()
    print(json.dumps({k: q[k] for k in ['row_counts', 'bounds', 'total_views', 'all_track_counts_zero']}, indent=2))
