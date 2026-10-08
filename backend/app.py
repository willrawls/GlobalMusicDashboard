import csv
import hashlib
import io
import json
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.analysis import artist_metrics, calendar, context, series, spikes
from backend.ingest import FILES, ROOT, safe_cell

DATA = ROOT / 'data'
app = FastAPI(title='Music Attention Atlas', version='1.0.0')
PALETTE = ['#117c79', '#7954b3', '#b45127', '#3565a4', '#af3e75', '#678233', '#936737']


def connect():
    db = sqlite3.connect((DATA / 'snapshot.sqlite').as_uri() + '?mode=ro&immutable=1', uri=True)
    db.row_factory = sqlite3.Row
    return db


def read_snapshot():
    with closing(connect()) as db:
        quality = json.loads(db.execute("SELECT value FROM metadata WHERE key='quality'").fetchone()[0])
        artists = [dict(r) for r in db.execute('SELECT * FROM artists')]
        for a in artists:
            a['tags_list'] = json.loads(a['tags_list'])
            a['aliases_list'] = json.loads(a['aliases_list'])
            a['color'] = PALETTE[int(hashlib.sha256(a['artist_mbid'].encode()).hexdigest()[:8], 16) % len(PALETTE)]
        return quality, artists, [dict(r) for r in db.execute('SELECT * FROM pageviews')], [dict(r) for r in db.execute('SELECT * FROM releases')]


class Filters(BaseModel):
    start: date | None = None
    end: date | None = None
    artists: str = Field('', max_length=2000)
    country: str = Field('', max_length=30)
    tag: str = Field('', max_length=200)
    q: str = Field('', max_length=200)
    coverage: Literal['available', 'complete'] = 'available'
    mode: Literal['common', 'available'] = 'common'
    indexed: bool = False
    smooth: bool = False
    year: int | None = Field(None, ge=1, le=9999)
    group: Literal['year', 'release_country', 'release_status', 'release_packaging', 'release_language', 'precision'] = 'year'
    page: int = Field(1, ge=1, le=10000)
    limit: int = Field(50, ge=1, le=500)
    sort: Literal['attention', 'name', 'coverage'] = 'attention'
    question: Literal['attention', 'spike', 'concentration', 'compare', 'countries', 'tags', 'missing', 'unsupported'] = 'attention'
    tag_metric: Literal['artists', 'total'] = 'artists'
    tag_search: str = Field('', max_length=200)
    dimension: Literal['countries', 'tags'] = 'countries'


def filtered(f):
    quality, all_artists, all_obs, all_releases = read_snapshot()
    low, high = quality['bounds']
    start, end = f.start.isoformat() if f.start else low, f.end.isoformat() if f.end else high
    if start < low or end > high or start > end or start > high or end < low:
        raise HTTPException(422, f'Dates must be ordered and within {low} to {high}; no silent clamping.')
    selected = f.artists.split(',') if f.artists else []
    known = {a['artist_mbid'] for a in all_artists}
    if set(selected) - known:
        raise HTTPException(422, 'Unknown artist MBID')
    if f.country and f.country not in {a['country'] or 'Unknown' for a in all_artists}:
        raise HTTPException(422, 'Unknown country')
    if f.tag and f.tag not in {t for a in all_artists for t in (a['tags_list'] or ['(No tags)'])}:
        raise HTTPException(422, 'Unknown tag')
    artists = [a for a in all_artists if (not selected or a['artist_mbid'] in selected)
               and (not f.country or (a['country'] or 'Unknown') == f.country)
               and (not f.tag or f.tag in (a['tags_list'] or ['(No tags)']))]
    days = calendar(start, end)
    ids = {a['artist_mbid'] for a in artists}
    observations = [p for p in all_obs if p['artist_mbid'] in ids and start <= p['date'] <= end]
    metrics = artist_metrics(artists, observations, days)
    if f.coverage == 'complete':
        metrics = [a for a in metrics if a['coverage'] == 1]
    ids = {a['artist_mbid'] for a in metrics}
    observations = [p for p in observations if p['artist_mbid'] in ids]
    releases = [r for r in all_releases if r['artist_mbid'] in ids]
    meta = {'filters': {**f.model_dump(mode='json'), 'start': start, 'end': end}, 'calendar_days': len(days),
            'eligible_artists': len(metrics), 'observed_artists': sum(a['observed_days'] > 0 for a in metrics),
            'observation_rows': len(observations), 'source_tables': ['artists', 'pageviews', 'releases'],
            'coverage_policy': f.coverage, 'snapshot_bounds': quality['bounds'],
            'definitions': {'total': 'Sum of valid captured daily views in selected dates; missing artist-days remain missing.',
              'coverage': 'Distinct observed dates / inclusive selected calendar days.',
              'comparison': 'Common observed dates by default; totals and median baselines use the same intersection.',
              'indexed': 'Observed median over effective dates = 100. Zero or absent median is undefined.',
              'smooth': 'Trailing mean needs seven consecutive observed calendar days within the effective window.',
              'spike': 'Current views / median of preceding seven calendar days; all seven observations and positive baseline required.',
              'releases': 'Distinct captured release MBIDs, not unique albums or complete discographies. Pageview dates do not filter release dates.'},
            'quality_flags': ['Uneven pageview coverage', 'Possibly capped release samples', 'Supplied summary is not authoritative', 'Track counts non-informative'],
            'source_hashes': quality['source_hashes']}
    return quality, all_artists, metrics, observations, releases, days, meta


@app.get('/health')
def health():
    try:
        with closing(connect()) as db:
            count = db.execute('SELECT COUNT(*) FROM artists').fetchone()[0]
        return {'status': 'ready', 'artists': count}
    except sqlite3.Error:
        raise HTTPException(503, 'Snapshot unreadable')


@app.get('/api/quality')
def quality_endpoint():
    return read_snapshot()[0]


@app.get('/api/options')
def options():
    quality, artists, _, _ = read_snapshot()
    return {'artists': artists, 'countries': sorted({a['country'] or 'Unknown' for a in artists}),
            'tags': sorted({t for a in artists for t in (a['tags_list'] or ['(No tags)'])}), 'bounds': quality['bounds']}


def result(kind, f):
    quality, all_artists, metrics, obs, releases, days, meta = filtered(f)
    total = sum(p['views'] for p in obs)
    daily = [{'date': d, 'views': sum(p['views'] for p in obs if p['date'] == d) if any(p['date'] == d for p in obs) else None,
              'artists': len({p['artist_mbid'] for p in obs if p['date'] == d})} for d in days]
    concentration, running = [], 0
    for i, a in enumerate(a for a in metrics if a['total'] is not None):
        running += a['total']
        concentration.append({'rank': i+1, 'artist_name': a['artist_name'], 'artist_mbid': a['artist_mbid'],
                              'share': running/total*100 if total else None, 'total': a['total']})
    if kind == 'overview':
        body = {'total': total if obs else None, 'artist_count': len(metrics), 'release_count': len(releases),
                'coverage': len(obs)/(len(metrics)*len(days)) if metrics else None, 'ranking': metrics,
                'daily': daily, 'concentration': concentration, 'collected_at': quality['collected_at']}
    elif kind == 'artists':
        rows = [a for a in metrics if f.q.casefold() in a['artist_name'].casefold()]
        if f.sort == 'name':
            rows.sort(key=lambda a: a['artist_name'])
        if f.sort == 'coverage':
            rows.sort(key=lambda a: -a['coverage'])
        body = {'rows': rows[(f.page-1)*f.limit:f.page*f.limit], 'count': len(rows)}
    elif kind in ['series', 'comparisons']:
        if kind == 'comparisons' and (not f.artists or len(f.artists.split(',')) > 5):
            raise HTTPException(422, 'Select one to five artists for a comparison.')
        body = series(metrics, obs, days, f.mode if kind == 'comparisons' else 'available', f.indexed, f.smooth)
        for a in body['artists']:
            matches = [p for p in obs if p['artist_mbid'] == a['artist_mbid']]
            a['source_slugs'] = sorted({p['source_url'] for p in matches})
            a['article_links'] = ['https://en.wikipedia.org/wiki/' + quote(s, safe='') for s in a['source_slugs']]
        body['spikes'] = spikes(metrics, obs)
        body['daily'] = daily
    elif kind == 'context':
        body = context(metrics)
        body['tags'] = sorted(
            [r for r in body['tags'] if f.tag_search.casefold() in r['name'].casefold()],
            key=lambda r: (-(r[f.tag_metric] or 0), r['name']))
    elif kind == 'releases':
        rows = [r for r in releases if (f.year is None or r['year'] == f.year)
                and (f.q.casefold() in (r['release_title'] or '').casefold() or f.q.casefold() in r['artist_name'].casefold())]
        groups = {}
        for r in rows:
            key = str(r[f.group]) if r[f.group] is not None else 'Unknown'
            groups.setdefault(key, set()).add(r['release_mbid'])
        bars = [{'name': k, 'total': len(v)} for k, v in groups.items() if f.group != 'year' or k != 'Unknown']
        bars.sort(key=lambda r: int(r['name']) if f.group == 'year' else -r['total'])
        body = {'rows': rows[(f.page-1)*f.limit:f.page*f.limit], 'count': len(rows), 'bars': bars,
                'distinct_editions': len({r['release_mbid'] for r in rows}), 'undated': sum(r['year'] is None for r in rows),
                'possibly_capped_artists': [a['artist_name'] for a in metrics if a['artist_name'] in quality['possibly_capped_artists']]}
    elif kind == 'questions':
        if f.question == 'compare':
            if not f.artists:
                return {'data': {'answer': 'Choose one to five artists above to compare their common observed dates.', 'rows': []}, 'meta': meta}
            return result('comparisons', f)
        rows, answer = [], ''
        if f.question == 'attention':
            rows = [{'artist_name': a['artist_name'], 'total': a['total'], 'observed_days': a['observed_days']} for a in metrics if a['total'] is not None]
            answer = f"{rows[0]['artist_name']} leads this filtered sample with {rows[0]['total']:,} captured views." if rows else 'No observations in this selection.'
        elif f.question == 'spike':
            rows = [r for r in spikes(metrics, obs) if r['ratio'] is not None]
            answer = f"{rows[0]['artist_name']} has the largest relative spike: {rows[0]['ratio']:.2f}× on {rows[0]['date']}. This does not establish a cause." if rows else 'Insufficient baseline: seven preceding observed days and a positive median are required.'
        elif f.question == 'concentration':
            rows = concentration
            answer = f"The top {min(5, len(rows))} observed artists account for {rows[min(4,len(rows)-1)]['share']:.1f}% of captured attention." if total and rows else 'Concentration is undefined without positive captured attention.'
        elif f.question in ['countries', 'tags']:
            rows = context(metrics)[f.question]
            answer = 'Recorded artist metadata, not listener locations. Tag groups overlap; do not add them as exclusive shares.'
        elif f.question == 'missing':
            rows = [{'artist_name': a['artist_name'], 'observed_days': a['observed_days'], 'missing_days': len(days)-a['observed_days']} for a in metrics if a['coverage'] < 1]
            answer = f'{len(rows)} artists have incomplete coverage in the selected window. Missing days do not mean zero attention.'
        else:
            answer = 'This snapshot cannot establish sales, streams, listener geography, future popularity, or causes of spikes. Those require sales or streaming records, audience geography, longitudinal validation, or independently sourced event evidence.'
        body = {'answer': answer, 'rows': rows}
    else:
        raise HTTPException(404)
    return {'data': body, 'meta': meta}


Kind = Literal['overview', 'artists', 'series', 'comparisons', 'releases', 'context', 'questions']


@app.get('/api/{kind}')
def api(kind: Kind, f: Annotated[Filters, Query()]):
    return result(kind, f)


@app.get('/downloads/original/{name}')
def original(name: str):
    if name not in [f'{n}.csv' for n in FILES]:
        raise HTTPException(404)
    return FileResponse(DATA / 'raw' / name, filename=name, media_type='text/csv')


@app.get('/downloads/manifest.json')
def manifest():
    return FileResponse(DATA / 'manifest.json', media_type='application/json')


@app.get('/downloads/cleaned/{table}.csv')
def cleaned(table: Literal['artists', 'releases', 'pageviews'], f: Annotated[Filters, Query()]):
    _, _, metrics, obs, releases, _, _ = filtered(f)
    rows = metrics if table == 'artists' else obs if table == 'pageviews' else releases
    if table == 'artists':
        rows = [r for r in rows if f.q.casefold() in r['artist_name'].casefold()]
    if table == 'releases':
        rows = [r for r in rows if (f.year is None or r['year'] == f.year) and
                (f.q.casefold() in (r['release_title'] or '').casefold() or f.q.casefold() in r['artist_name'].casefold())]
    return csv_response(rows, f'cleaned-{table}.csv')


@app.get('/downloads/result/{kind}.{format}')
def export_result(kind: Kind, format: Literal['csv', 'json'], f: Annotated[Filters, Query()]):
    payload = result(kind, f.model_copy(update={'page': 1, 'limit': 100000}))
    if format == 'json':
        return Response(json.dumps(payload, ensure_ascii=False), media_type='application/json',
                        headers={'Content-Disposition': f'attachment; filename="{kind}-with-metadata.json"'})
    data = payload['data']
    rows = data.get('rows', data.get('ranking', data.get('countries', [])))
    if kind == 'context':
        rows = data[f.dimension]
    if kind in ['comparisons', 'series'] or (kind == 'questions' and f.question == 'compare'):
        rows = [{'artist_mbid': a['artist_mbid'], 'artist_name': a['artist_name'], **p} for a in data['artists'] for p in a['points']]
    return csv_response(rows, f'{kind}.csv')


def csv_response(rows, name):
    buffer = io.StringIO(newline='')
    fields = list(rows[0]) if rows else ['no_matching_rows']
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    writer.writerows({k: safe_cell(v) for k, v in r.items()} for r in rows)
    return Response(buffer.getvalue(), media_type='text/csv; charset=utf-8', headers={'Content-Disposition': f'attachment; filename="{name}"'})


if (ROOT / 'dist/assets').exists():
    app.mount('/assets', StaticFiles(directory=ROOT / 'dist/assets'), name='assets')


@app.get('/{path:path}')
def frontend(path: str):
    valid = {'', 'artists', 'attention', 'releases', 'context', 'questions', 'methodology', 'explore'}
    if path not in valid:
        if not path.startswith('artists/') or path.split('/')[-1] not in {a['artist_mbid'] for a in read_snapshot()[1]}:
            raise HTTPException(404, 'Route not found')
    if not (ROOT / 'dist/index.html').exists():
        raise HTTPException(503, 'Frontend build missing; run npm run build')
    return FileResponse(ROOT / 'dist/index.html')
