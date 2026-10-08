import csv
import hashlib
import io
import json
import shutil
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.analysis import artist_metrics, calendar, context, series, spikes
from backend.app import app, read_snapshot
from backend.ingest import FILES, ROOT, ingest, partial_date, safe_cell

client = TestClient(app)
quality, artists, obs, releases = read_snapshot()


def test_source_hashes_and_snapshot_regression():
    expected = json.loads((ROOT/'tests/source_hashes.json').read_text(encoding='utf-8'))
    assert quality['source_hashes'] == expected
    for name, digest in expected.items():
        assert hashlib.sha256((ROOT/'data/raw'/name).read_bytes()).hexdigest() == digest
    assert (len(artists), len(releases), len(obs)) == (51, 4931, 1493)
    assert sum(r['views'] for r in obs) == 9509128
    assert quality['bounds'] == ['2026-09-05', '2026-10-04']
    assert len(quality['possibly_capped_artists']) == 42
    assert quality['all_track_counts_zero']


def test_identity_and_summary_are_audited():
    m = artist_metrics(artists, obs, calendar(*quality['bounds']))
    assert next(a for a in m if a['artist_name']=='Arijit Singh')['total'] == 79015
    assert next(a for a in m if a['artist_name']=='JAŸ-Z')['observed_days'] == 23
    assert next(a for a in m if a['artist_name']=='Kanye West Tribute Band')['total'] is None
    assert sum(a['observed_days']==30 for a in m) == 49
    assert len(quality['summary_missing_artists']) == 9
    assert len(quality['identity_matches']) == 50
    assert all(r['method']=='exact' for r in quality['identity_matches'])


def test_ingestion_repeatable(tmp_path):
    shutil.copytree(ROOT/'data/raw', tmp_path/'data/raw')
    first = ingest(tmp_path)
    db_first = (tmp_path/'data/snapshot.sqlite').read_bytes()
    assert ingest(tmp_path) == first
    assert (tmp_path/'data/snapshot.sqlite').read_bytes() == db_first
    with sqlite3.connect(tmp_path/'data/snapshot.sqlite') as db:
        assert db.execute('SELECT COUNT(*) FROM raw_rows').fetchone()[0] == sum(quality['row_counts'].values())


@pytest.mark.parametrize('raw,expected',[('',(None,None,None,'unknown')),('2020',(2020,None,None,'year')),('2020-02',(2020,2,None,'month')),('2020-02-29',(2020,2,29,'day'))])
def test_partial_dates(raw,expected):
    assert partial_date(raw)==expected


@pytest.mark.parametrize('raw',['2020-02-30','20','2020-13','2020-01-01x'])
def test_bad_dates(raw):
    with pytest.raises(ValueError):
        partial_date(raw)


def fixture_rows():
    aa=[{'artist_mbid':'a','artist_name':'A','country':'US','tags_list':['pop','rock'],'color':'teal'},
        {'artist_mbid':'b','artist_name':'B','country':None,'tags_list':['pop'],'color':'violet'}]
    days=calendar('2026-01-01','2026-01-10')
    pp=[{'artist_mbid':'a','date':d,'views':0 if i==0 else 10 if i<8 else 100} for i,d in enumerate(days)]
    pp += [{'artist_mbid':'b','date':d,'views':20} for i,d in enumerate(days) if i!=4]
    return aa,pp,days


def test_missing_vs_zero_common_dates_and_index():
    aa,pp,days=fixture_rows()
    out=series(aa,pp,days,'common',True)
    assert out['effective_day_count']==9
    assert out['artists'][0]['points'][0]['value']==0
    assert out['artists'][0]['points'][4]['value'] is None
    assert out['artists'][1]['points'][4]['raw_views'] is None
    assert out['artists'][0]['baseline']==10
    assert out['artists'][0]['total']==260
    assert out['artists'][1]['total']==180


def test_smoothing_and_spike_baselines():
    aa,pp,days=fixture_rows()
    out=series(aa,pp,days,'available',False,True)
    assert out['artists'][0]['points'][5]['value'] is None
    assert out['artists'][0]['points'][6]['value']==pytest.approx(60/7)
    assert out['artists'][1]['points'][9]['value'] is None
    ss=spikes(aa,pp)
    assert next(p for p in ss if p['artist_mbid']=='a' and p['date']==days[8])['ratio']==10
    assert next(p for p in ss if p['artist_mbid']=='b' and p['date']==days[9])['ratio'] is None
    zeros=[{**p,'views':0} for p in pp]
    assert all(p['ratio'] is None for p in spikes(aa,zeros))
    assert all(p['value'] is None for a in series(aa,zeros,days,'available',True)['artists'] for p in a['points'])


def test_empty_intersection_and_country_tag_fanout():
    aa,pp,days=fixture_rows()
    metrics=artist_metrics(aa,pp,days)
    ctx=context(metrics)
    total=sum(p['views'] for p in pp)
    assert sum(c['total'] for c in ctx['countries'])==total
    assert next(t for t in ctx['tags'] if t['name']=='pop')['total']==total
    empty=series(aa,[p for p in pp if p['artist_mbid']=='a'],days,'common')
    assert empty['effective_day_count']==0
    assert all(a['total'] is None for a in empty['artists'])


def test_totals_reconcile_across_api_and_exports():
    params={'country':'US','start':'2026-09-10','end':'2026-09-20','tag':'pop'}
    over=client.get('/api/overview',params=params).json()['data']
    directory=client.get('/api/artists',params={**params,'limit':500}).json()['data']
    ctx=client.get('/api/context',params=params).json()['data']
    assert over['total']==sum(a['total'] or 0 for a in directory['rows'])==sum(c['total'] or 0 for c in ctx['countries'])
    rows=list(csv.DictReader(io.StringIO(client.get('/downloads/cleaned/pageviews.csv',params=params).text)))
    assert sum(int(r['views']) for r in rows)==over['total']
    questions=client.get('/api/questions',params=params).json()['data']
    assert questions['rows'][0]['total']==directory['rows'][0]['total']


@pytest.mark.parametrize('path',['/health','/api/overview','/api/artists','/api/series','/api/releases','/api/context','/api/questions','/api/quality','/api/options'])
def test_endpoints(path):
    assert client.get(path).status_code==200


def test_explore_direct_route_and_invalid_neighbor():
    response = client.get('/explore')
    assert response.status_code == 200
    assert 'text/html' in response.headers['content-type']
    assert client.get('/explore/nonexistent').status_code == 404


@pytest.mark.parametrize('params',[{'start':'2020-01-01'},{'end':'2026-09-01'},{'start':'2026-10-04','end':'2026-09-05'}, {'artists':'invalid'},{'country':'BAD'},{'tag':'not-a-real-tag'},{'limit':10000},{'sort':'DROP TABLE artists'},{'page':0}])
def test_invalid_inputs(params):
    assert client.get('/api/overview',params=params).status_code==422


def test_comparison_export_and_original_bytes():
    ids=','.join(a['artist_mbid'] for a in artists if a['artist_name'] in ['JAŸ-Z','Taylor Swift'])
    result=client.get('/api/comparisons',params={'artists':ids}).json()['data']
    assert result['effective_day_count']==23
    rows=list(csv.DictReader(io.StringIO(client.get('/downloads/result/comparisons.csv',params={'artists':ids}).text)))
    for a in result['artists']:
        assert sum(float(r['value']) for r in rows if r['artist_mbid']==a['artist_mbid'] and r['value'])==a['total']
    for name in FILES:
        assert client.get(f'/downloads/original/{name}.csv').content==(ROOT/'data/raw'/f'{name}.csv').read_bytes()
    assert client.get('/api/comparisons').status_code==422


def test_safe_exports_and_no_arbitrary_paths():
    assert safe_cell('=HYPERLINK("bad")').startswith("'")
    assert safe_cell(' +SUM(1)').startswith("'")
    assert safe_cell('075678762857')=='075678762857'
    assert client.get('/downloads/original/requirements.lock').status_code==404
    assert client.get('/api/nonexistent').status_code!=200
    assert client.get('/artists/not-an-id').status_code==404


def test_releases_and_empty_states():
    out=client.get('/api/releases',params={'year':2012,'q':'Unorthodox'}).json()['data']
    rows=list(csv.DictReader(io.StringIO(client.get('/downloads/cleaned/releases.csv',params={'year':2012,'q':'Unorthodox'}).text)))
    assert len(rows)==out['count']
    assert all(r['year']=='2012' for r in rows)
    assert len(set(r['release_mbid'] for r in rows))==out['distinct_editions']
    assert client.get('/api/artists',params={'q':'no such artist xyz'}).json()['data']['count']==0


def test_real_tag_membership_counts_and_export():
    tags = client.get('/api/context').json()['data']['tags']
    by_name = {r['name']: r for r in tags}
    for name, count, total in [('rapper', 4, 1014776), ('pop', 40, 8844037), ('pop soul', 13, 3591993)]:
        assert by_name[name]['artists'] == count
        assert by_name[name]['total'] == total
    assert [r['artists'] for r in tags] == sorted((r['artists'] for r in tags), reverse=True)
    filtered = client.get('/api/context', params={'tag_search':'rapper','tag_metric':'total'}).json()['data']['tags']
    exported = list(csv.DictReader(io.StringIO(client.get('/downloads/result/context.csv', params={'tag_search':'rapper','tag_metric':'total','dimension':'tags'}).text)))
    assert [r['name'] for r in exported] == [r['name'] for r in filtered]
    assert all('rapper' in r['name'] for r in filtered)
    assert next(int(r['artists']) for r in exported if r['name']=='rapper') == 4


def test_single_artist_shared_tags_legitimately_have_equal_values():
    artist = next(a for a in artists if len(a['tags_list']) > 3 and any(p['artist_mbid']==a['artist_mbid'] for p in obs))
    tags = client.get('/api/context',params={'artists':artist['artist_mbid']}).json()['data']['tags']
    expected = sum(p['views'] for p in obs if p['artist_mbid']==artist['artist_mbid'])
    assert {r['name'] for r in tags} == set(artist['tags_list'])
    assert all(r['artists']==1 and r['total']==expected for r in tags)
