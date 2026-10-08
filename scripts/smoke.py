"""Verify a running local or Railway release, including byte-for-byte sources."""
import csv
import hashlib
import io
import json
import sys
from pathlib import Path
import httpx

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000'
root = Path(__file__).resolve().parents[1]
expected = json.loads((root/'data/manifest.json').read_text(encoding='utf-8'))
checks = []
with httpx.Client(base_url=base, timeout=30, follow_redirects=True) as c:
    def get(path):
        r = c.get(path)
        r.raise_for_status()
        checks.append(path)
        return r

    assert get('/health').json()['status'] == 'ready'
    overview = get('/api/overview').json()
    assert overview['data']['total'] == 9509128
    assert overview['data']['artist_count'] == 51
    assert overview['data']['release_count'] == 4931
    assert overview['meta']['observation_rows'] == 1493
    q = get('/api/quality').json()
    assert q['source_hashes'] == expected
    assert get('/downloads/manifest.json').json() == expected
    for name, sha in expected.items():
        assert hashlib.sha256(get('/downloads/original/'+name).content).hexdigest() == sha
    artists = get('/api/artists?limit=500').json()['data']['rows']
    jay = next(a for a in artists if a['artist_name']=='JAŸ-Z')
    tribute = next(a for a in artists if a['artist_name']=='Kanye West Tribute Band')
    arijit = next(a for a in artists if a['artist_name']=='Arijit Singh')
    assert jay['observed_days'] == 23 and tribute['total'] is None and arijit['total'] == 79015
    for path in ['/', '/artists', '/artists/'+jay['artist_mbid'], '/attention', '/releases', '/context', '/questions', '/methodology']:
        assert '<div id="root"></div>' in get(path).text
    for path in ['/api/series', '/api/releases', '/api/context', '/api/questions', '/api/options']:
        get(path).json()
    comparison = get('/api/comparisons?artists='+jay['artist_mbid']+','+arijit['artist_mbid']).json()['data']
    assert comparison['effective_day_count'] == 23
    for question in ['attention','spike','concentration','countries','tags','missing','unsupported','compare']:
        get('/api/questions?question='+question).json()
    csv_text = get('/downloads/cleaned/pageviews.csv?artists='+arijit['artist_mbid']).text
    assert sum(int(r['views']) for r in csv.DictReader(io.StringIO(csv_text))) == 79015
    assert c.get('/api/overview?start=2020-01-01').status_code == 422
    assert c.get('/api/nonexistent').status_code != 200
print(json.dumps({'base_url':base,'passed':len(checks),'source_hashes_match':True,'snapshot_totals_match':True,'paths':checks},indent=2))
