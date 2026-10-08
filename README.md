# Music Attention Atlas

Live: https://music-attention-atlas-production.up.railway.app · Validation and deployed version: [RELEASE_REPORT.md](RELEASE_REPORT.md).

Seven-page React/TypeScript dashboard backed by FastAPI and an immutable SQLite snapshot. The original six CSVs are preserved in `data/raw`. No accounts, live data collection, writable database, paid AI API, or separate database service is used.

Appearance defaults to Night Owl. The upper-left switch below the logo selects Light Owl and remembers the choice under `atlas-owl-theme`. The saved theme is applied before React renders; charts use a stable artist color assignment with separate light/dark contrast values.

## Run locally (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.lock
npm ci
.\.venv\Scripts\python -m backend.ingest
npm run build
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000. For frontend development, run `npm run dev` in a second terminal; Vite proxies API and download routes to port 8000. Python 3.14 and Node 24 are used in the production image.

## Data and calculations

- Snapshot: September 5–October 4, 2026; collected October 5, 2026.
- 51 artist records, 4,931 captured release rows, 1,493 pageview observations, 9,509,128 captured views.
- 49 artists have 30 observed days. JAŸ-Z has 23; Kanye West Tribute Band has none. Its missing observations remain missing.
- Pageviews join by unique exact artist name; unique NFKC normalization is the only fallback. Every match is audited. No fuzzy joins occur.
- Artist MBIDs are stable identities. Raw rows and source row numbers are retained in SQLite; source bytes and SHA-256 hashes are preserved.
- Blanks become null; semicolon-separated tags and aliases are trimmed and deduplicated within each artist. Original strings remain available.
- Release dates retain year/month/day precision. Barcodes remain strings, including leading zeros. Charts count distinct captured release MBIDs, not albums or a complete discography.
- Totals sum observations within the selected window. Coverage is distinct observed dates divided by inclusive calendar days. Dates outside the snapshot are rejected rather than silently clamped.
- Comparisons default to the intersection of observed dates. Totals and median baselines use this intersection. Available-days mode is explicitly labeled. Median indexing is undefined for zero or absent medians.
- Trailing means need seven consecutive observations; spike ratios require all seven preceding calendar days and a positive median. Neither bridges gaps. Spikes are descriptive, not proof of causation or statistical significance.
- Country buckets partition the included artists, including unknown. Tags overlap but each artist counts only once in an individual tag.
- The supplied summary is an audit reference only. It omits nine artists and reports zero for Arijit Singh instead of the recomputed 79,015. All disagreements are in `data/quality.json`.
- 42 artist release sets contain exactly 100 rows, suggesting a cap. All track counts are zero and excluded from analysis.

`data/manifest.json` contains all six source hashes. `data/quality.json` contains schemas, missingness, identity matches, summary disagreements, transformations, collection timestamps, and dictionary discrepancies. Regression expectations in `tests/source_hashes.json` are bound to this snapshot.

## Routes and exports

Pages: `/`, `/artists`, `/artists/{mbid}`, `/attention`, `/releases`, `/context`, `/questions`, `/methodology`.

Typed API documentation: `/docs`. API routes cover overview, artists, series, comparisons, releases, context, questions, quality, and filter options. Filter values and pagination are validated. SQL is fixed and parameterized; the API accepts no arbitrary SQL or filesystem path.

Global filters are stored in URLs. Pageview date filters affect observed metrics and coverage eligibility; release year is a separate filter. Release counts never imply publication within the selected pageview window. Artist detail release previews explicitly show all captured years.

- `/downloads/original/{filename}` returns exact source bytes from a six-file whitelist.
- `/downloads/cleaned/{artists|pageviews|releases}.csv` exports all matching cleaned rows, independent of table pagination.
- `/downloads/result/{endpoint}.csv` exports the complete filtered result; comparison exports include displayed values, raw observations, and effective-date inclusion.
- `/downloads/result/{endpoint}.json` includes the full result, definitions, effective filters, coverage policy, source row counts, quality flags, and hashes. Overview JSON includes ranking, daily totals, contributing artist counts, and concentration. Context JSON includes countries and tags.
- Cleaned/result CSVs escape cells that could be interpreted as spreadsheet formulas. Original downloads intentionally remain unchanged.

## Replace the snapshot

1. Replace all six files in `data/raw`, retaining their actual schemas.
2. Run `python -m backend.ingest`. Invalid types, ambiguous identities, duplicate artist-days, and invalid dates stop ingestion with the original files preserved.
3. Review `data/quality.json` and generated cleaned exports. The SQLite file is rebuilt transactionally, not appended to.
4. Update snapshot regression hashes and expectations only after auditing the replacement. Do not change assertions just to make tests pass.
5. Run tests and the production build; deploy a new immutable image.

## Railway

The production `Dockerfile` builds React, installs pinned Python packages, copies all six raw CSVs, and generates the database, manifest, quality report, and cleaned exports inside the image. Runtime uses an unprivileged user and opens SQLite with `mode=ro&immutable=1`. No persistent volume is required.

The app binds to `0.0.0.0` and Railway's `PORT`. `railway.json` configures `/health`; readiness succeeds only when SQLite can be queried. SPA routing is restricted to valid pages and artist identities; unknown API paths do not fall back to HTML.

```powershell
npx @railway/cli login
npx @railway/cli up --project 80c7818e-7b17-4735-a535-144f78a21a49 --environment e546e367-43e0-4a70-84af-4c59255afa87 --service ffe5b007-69e8-4dbd-b1cd-6b100cc45a47 --detach
```

Official references checked during implementation: [local-source deployment](https://docs.railway.com/cli/deploying), [health checks](https://docs.railway.com/deployments/healthchecks). Existing Railway projects are unrelated to this deployment.

## Attribution and evidence limitations

Source attribution supplied in the CSVs: MusicBrainz metadata, Wikimedia pageviews, collector timestamps. No dataset license, raw API responses, or collector code were supplied. No dataset-wide license is asserted by this application.

MusicBrainz distinguishes CC0 core data from CC BY-NC-SA 3.0 supplementary data; consult [MusicBrainz data licensing](https://musicbrainz.org/doc/About/Data_License) before commercial reuse, especially community tags. This does not establish the licensing of the supplied combined dataset. Source metadata and attribution remain available in original downloads.

The release dictionary declares English Wikipedia all-access user pageviews, but request settings cannot be independently verified from article slugs alone. Constructed Wikipedia article links are labeled separately from preserved source slugs. See [Wikimedia's pageview definition](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/concepts/page-views.html).

Pageviews are an attention proxy, not sales, streams, unique listeners, artistic merit, listener geography, or comprehensive global demand. No additional music data or artwork has been fetched. Guided questions calculate deterministic answers and explain unsupported inferences.
