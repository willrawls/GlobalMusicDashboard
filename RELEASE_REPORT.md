# Music Attention Atlas — release report

## Community tag clarity update

Published October 8, 2026; source `bc115ee`, deployment `d633b3d4-6074-4106-947e-ff846510ed1c`.

The unfiltered aggregation was correct: pop has 40 artists / 8,844,037 views; pop soul has 13 / 3,591,993; rapper has 4 / 1,014,776. A single-artist filter reproduces identical totals across that artist's tags. The previous panel displayed unlabeled pageviews and lacked visible artist-filter controls on the context page.

The panel now defaults to explicitly labeled artist counts, offers a captured-pageviews selector and tag search, displays artist filter chips and a scope explanation, and exports the matching tag rows. All 38 tests passed, including real-snapshot tag regressions and the valid single-artist equal-values case. Production build, mobile overflow check, live browser counts for all three tags, live health, and matching tag CSV export passed.

## Night Owl / Light Owl update

Published October 8, 2026. Night Owl is now the default; a labeled, keyboard-accessible switch beneath the logo at the upper left selects Light Owl. Both palettes reuse the established budget-site colors, with theme-aware chart colors. Preference persists across reloads and navigation and is applied before React renders.

- Source commit: `a9acbaf`
- Successful Railway deployment: `65dfe08a-8cc1-47b0-b1c4-be45d35840a3`
- Container digest: `sha256:f510a959e580196fae68f8536c6e10de88392a92c887d767ea07798232eef6e2`
- Production build and `git diff --check` passed. Browser checks verified both themes, keyboard switching, reload/navigation persistence, mobile upper-left placement without page overflow, and dark chart colors. Live checks confirmed Night Owl `#011627`, Light Owl `#fbfbfb`, saved switching, and the unchanged 9,509,128-view total.

## Initial release

Verified on October 8, 2026.

**Live dashboard:** https://music-attention-atlas-production.up.railway.app

**Railway project and service:** `music-attention-atlas` (new project; existing projects untouched).

- Project: `80c7818e-7b17-4735-a535-144f78a21a49`
- Service: `ffe5b007-69e8-4dbd-b1cd-6b100cc45a47`
- Environment: `production`, `e546e367-43e0-4a70-84af-4c59255afa87`
- Successful deployment: `fb2ad5a4-53f1-4b7a-a77c-e885ea0f4414`
- Container image digest: `sha256:5c5b7fab2c9580073286f3232272eaf5545794c50351ae3e5132a08a17ce1436`
- The service reads Railway's injected `PORT` (8080 on this deployment); its public domain routes to that port.

## Delivered

Seven responsive pages, dark mode, shareable filters, artist MBID detail routes, search/pagination, daily charts, rankings, concentration, artist/day heatmaps, common-date comparisons, indexed and smoothed lines, spike exploration, release metadata analysis, countries/tags, guided deterministic questions, and data methodology/audits. Accessible tables accompany chart data; source and filtered cleaned exports are available.

React/TypeScript frontend, FastAPI backend, generated SQLite database opened read-only, all six unmodified CSV sources, checksums, cleaned exports, audit reports, locked dependencies, production Dockerfile, and local/deployment documentation are included. There are no runtime collection calls, external AI services, separate database, or persistent volume.

## Validation actually performed

- Production TypeScript/Vite build passed locally and in Railway's Linux Docker build.
- 36 pytest tests passed, including repeatable ingestion, hash-bound snapshot regression, audited joins, missing versus zero, partial dates, common-date baselines, smoothing, spikes, country partitions/tag fan-out, invalid filters, empty states, CSV formula protection, and original download bytes.
- 34 local HTTP checks and the same 34 public HTTPS checks passed using `scripts/smoke.py`; additional invalid-date and unknown-API checks passed.
- All seven pages inspected through browser DOM at desktop and 390×844 mobile viewport; no page-level horizontal overflow. Overview and artist-detail screenshots visually inspected. Tables and heatmaps intentionally allow internal horizontal scrolling on narrow screens.
- All seven public pages rendered successfully with no captured browser errors.
- Keyboard activation of calculation disclosure and the live incomplete-coverage question were exercised successfully.
- A JAŸ-Z/Taylor Swift comparison displayed 23 common observed dates; indexed/smoothed controls and dark mode were exercised. Direct artist routes and constructed encoded Wikipedia links were verified.
- Published original files match every local source SHA-256 hash. Published manifest and database-derived quality hashes match the ingestion manifest.
- Verified live counts: 51 artists, 4,931 releases, 1,493 observations, 9,509,128 views. Arijit Singh is 79,015; JAŸ-Z has 23 observed days; the tribute band retains null attention.
- npm audit after removing deployment CLI tooling from app dependencies reported zero vulnerabilities. The Railway frontend build also reported zero.
- Build/runtime logs inspected; readiness passed. Docker was unavailable locally, so container validation was performed on the actual Railway build and running container through public HTTP checks rather than a claimed local container test.

## Source hashes

| Original file | SHA-256 |
|---|---|
| artists.csv | 613d6600f2eeb964826320a7ed5a4194ffd0c23f7e671a81bc9e7c62db2f1771 |
| releases.csv | 16b86f6becd110dad615155d8c74cb449a1e812669cd8800e58f027f77abd220 |
| pageviews.csv | 14b9bfcb5a615554283a0c5e7e871f81021ffb9a6c1fe79f0e8c95057676db1c |
| artist_attention_summary.csv | bfe8f98770098e3bb9312c958604871ac3c5c2da479bbb6645c63faf00f17ae0 |
| data_dictionary.csv | fb7993bd84e023906d9524c5a6e812e4cf861b48e366cc0209b761cb9f24bd16 |
| data_dictionary_release.csv | 3eaff33475886fec296f5bf3e59cff61d5513a971607692218ed0a7762eb6f22 |

Also available at `/downloads/manifest.json` and locally in `data/manifest.json`.

## Remaining limits and maintenance

- This is a fixed collected sample, not comprehensive global demand. Missing observations remain gaps. No sales, streaming, listener-location, forecasting, or causal claims are made.
- 42 release sets appear capped at 100 rows; zero track counts cannot support analysis. Earliest captured release dates do not establish debuts.
- The supplied summary and dictionaries contain errors. Dashboard results use the observed rows, with discrepancies retained in the audit.
- Original request URLs, raw responses, collector code, and a combined dataset license were not supplied. Attribution and upstream licensing references appear in the methodology and README.
- Vite reports a large single client bundle (about 624 KB minified / 185 KB gzip) and nonblocking Lucide module-directive notices. These do not prevent the verified build or rendering.
- Starlette emits a test-client deprecation notice for httpx; tests currently pass.
- Railway CLI warns that legacy `railway.json` configuration remains supported until December 1, 2026. Migrate to Railway IaC or service-managed configuration before that cutoff; the current release successfully applied Docker build and `/health` settings.
- The original root upload hit a Windows indexing permission error. The successful upload used an explicit clean packaging directory, `artifacts/deploy`, with `--path-as-root --no-gitignore`. No public source repository was created.
- Public domain creation initially required an additional approval. The user explicitly authorized publishing the dashboard and all six CSVs, after which domain creation and HTTPS validation succeeded. No deployment blocker remains.
