"""Pure calculations. Missing observations are never imputed."""
from collections import defaultdict
from datetime import date, timedelta
from statistics import median


def calendar(start, end):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    return [(first + timedelta(days=i)).isoformat() for i in range((last-first).days+1)]


def trailing(values, day, preceding=False):
    end = date.fromisoformat(day) - timedelta(days=int(preceding))
    days = [(end-timedelta(days=i)).isoformat() for i in range(7)]
    return [values[d] for d in days] if all(d in values for d in days) else None


def artist_metrics(artists, observations, days):
    grouped = defaultdict(list)
    for row in observations:
        grouped[row['artist_mbid']].append(row)
    result = []
    for artist in artists:
        rows = grouped[artist['artist_mbid']]
        views = [r['views'] for r in rows]
        peak = max(rows, key=lambda r: r['views']) if rows else None
        result.append({**artist, 'total': sum(views) if rows else None, 'observed_days': len(rows),
                       'coverage': len(rows)/len(days), 'median': median(views) if rows else None,
                       'mean': sum(views)/len(rows) if rows else None,
                       'peak_date': peak['date'] if peak else None, 'peak_views': peak['views'] if peak else None})
    return sorted(result, key=lambda a: (-(a['total'] or 0), a['artist_name']))


def series(artists, observations, days, mode='available', indexed=False, smooth=False):
    values = {a['artist_mbid']: {} for a in artists}
    for p in observations:
        values[p['artist_mbid']][p['date']] = p['views']
    common = set.intersection(*(set(v) for v in values.values())) if values else set()
    effective = [d for d in days if mode == 'available' or d in common]
    result = []
    for a in artists:
        source = values[a['artist_mbid']]
        usable = {d: v for d, v in source.items() if d in effective}
        baseline = median(usable.values()) if usable else None
        points = []
        for d in days:
            value = usable.get(d)
            if smooth:
                window = trailing(usable, d)
                value = sum(window)/7 if window else None
            if indexed:
                value = value/baseline*100 if value is not None and baseline and baseline > 0 else None
            points.append({'date': d, 'value': value, 'raw_views': source.get(d), 'included': d in effective})
        result.append({'artist_mbid': a['artist_mbid'], 'artist_name': a['artist_name'], 'color': a['color'],
                       'total': sum(usable.values()) if usable else None, 'observed_days': len(source),
                       'effective_days': len(usable), 'baseline': baseline, 'points': points})
    return {'artists': result, 'effective_dates': effective, 'effective_day_count': len(effective), 'mode': mode,
            'indexed': indexed, 'smooth': smooth}


def spikes(artists, observations):
    names = {a['artist_mbid']: a['artist_name'] for a in artists}
    groups = defaultdict(dict)
    for p in observations:
        groups[p['artist_mbid']][p['date']] = p['views']
    rows = []
    for mbid, values in groups.items():
        for day, views in values.items():
            window = trailing(values, day, preceding=True)
            base = median(window) if window else None
            rows.append({'artist_mbid': mbid, 'artist_name': names[mbid], 'date': day, 'views': views,
                         'baseline': base, 'ratio': views/base if base and base > 0 else None,
                         'excess': views-base if base and base > 0 else None})
    return sorted(rows, key=lambda r: -(r['ratio'] or 0))


def context(metrics):
    result = {}
    for dimension in ['countries', 'tags']:
        groups = defaultdict(list)
        for a in metrics:
            keys = [a['country'] or 'Unknown'] if dimension == 'countries' else (a['tags_list'] or ['(No tags)'])
            for key in keys:
                groups[key].append(a)
        result[dimension] = sorted([{'name': k, 'artists': len(v), 'observed_artists': sum(a['observed_days'] > 0 for a in v),
                                     'total': sum(a['total'] or 0 for a in v) if any(a['observed_days'] for a in v) else None}
                                    for k, v in groups.items()], key=lambda r: -(r['total'] or 0))
    return result
