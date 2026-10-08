import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import {
  AudioLines,
  LayoutDashboard,
  Users,
  ChartNoAxesCombined,
  Disc3,
  Globe2,
  MessageCircleQuestion,
  Database,
  Moon,
  Sun,
  Download,
  RotateCcw,
  Search,
  ChevronRight,
  Compass,
} from "lucide-react";
import Explore from "./Explore";
import "./styles.css";

type Row = Record<string, any>;
// Preserve artist color assignments while adapting their contrast to each theme.
const owlColor = (color: string) => {
  const slot = [
    "#117c79",
    "#7954b3",
    "#b45127",
    "#3565a4",
    "#af3e75",
    "#678233",
    "#936737",
  ].indexOf(color);
  return `var(--chart-${Math.max(0, slot)})`;
};
const fmt = (v: any) =>
  v == null
    ? "—"
    : typeof v === "number"
      ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : String(v);
const compact = (v: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/artists", "Artists", Users],
  ["/attention", "Attention & comparisons", ChartNoAxesCombined],
  ["/releases", "Release patterns", Disc3],
  ["/context", "Countries & tags", Globe2],
  ["/questions", "Ask the data", MessageCircleQuestion],
  ["/explore", "Explore", Compass],
  ["/methodology", "Data & methodology", Database],
] as const;
const titles: Row = {
  "/explore": [
    "Explore",
    "Follow the sources and discover the wider world behind the data.",
  ],
  "/": [
    "The attention landscape",
    "Explore public attention across this captured artist sample.",
  ],
  "/artists": [
    "Meet the artists",
    "A directory of identities, metadata, and observed attention.",
  ],
  "/attention": [
    "Follow the signal",
    "Compare captured attention and explore changes over time.",
  ],
  "/releases": [
    "Inside the captured catalog",
    "Release editions and their metadata—not complete discographies.",
  ],
  "/context": [
    "Places & shared labels",
    "The countries and community tags represented in this sample.",
  ],
  "/questions": [
    "Ask a better question",
    "Real calculations from this snapshot. No AI guesswork.",
  ],
  "/methodology": [
    "Know the evidence",
    "Trace every result to its source and understand what is missing.",
  ],
};

function Table({
  rows,
  columns,
  limit = 50,
}: {
  rows: Row[];
  columns: [string, string, ((r: Row) => React.ReactNode)?][];
  limit?: number;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([k, label]) => (
              <th key={k} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => (
            <tr key={i}>
              {columns.map(([k, , render]) => (
                <td key={k}>{render ? render(r) : fmt(r[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty">
          No matching records. Missing observations are not zero.
        </p>
      )}
      {rows.length > limit && (
        <p className="hint">
          Showing {limit} of {rows.length} rows. Download the complete filtered
          result.
        </p>
      )}
    </div>
  );
}
function Panel({
  title,
  sub,
  children,
  wide = false,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={"panel " + (wide ? "wide" : "")}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </section>
  );
}
function Bars({
  rows,
  onSelect,
  value = "total",
  label = "name",
  limit = 12,
  unit = "",
  detail,
}: {
  rows: Row[];
  onSelect?: (r: Row) => void;
  value?: string;
  label?: string;
  limit?: number;
  unit?: string;
  detail?: (row: Row) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r[value] || 0));
  return (
    <div className="bars">
      {rows.slice(0, limit).map((r, i) => (
        <button
          disabled={!onSelect}
          onClick={() => onSelect?.(r)}
          className="bar-row"
          key={i}
          title={`${r[label]}: ${fmt(r[value])}${unit ? " " + unit : ""}`}
        >
          <span className="rank">{String(i + 1).padStart(2, "0")}</span>
          <span className="bar-content">
            <span className="bar-text">
              <strong>{r[label]}</strong>
              <span>
                {fmt(r[value])}
                {unit
                  ? " " +
                    (unit === "artists" && r[value] === 1 ? "artist" : unit)
                  : ""}
              </span>
            </span>
            <span className="track">
              <span
                style={{
                  width: `${((r[value] || 0) / max) * 100}%`,
                  background: owlColor(r.color),
                }}
              />
            </span>
            {detail && <small className="bar-detail">{detail(r)}</small>}
          </span>
          {onSelect && <ChevronRight size={15} />}
        </button>
      ))}
      {!rows.length && (
        <p className="empty">No observations in this selection.</p>
      )}
    </div>
  );
}
function Trend({
  rows,
  value = "views",
  label = "Captured views",
  color = "var(--chart-0)",
}: {
  rows: Row[];
  value?: string;
  label?: string;
  color?: string;
}) {
  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`${label} by ${rows[0]?.rank ? "artist rank" : "date"}; exact values in table below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 15, right: 18, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={"fill" + value} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4" />
            <XAxis
              dataKey={rows[0]?.rank ? "rank" : "date"}
              minTickGap={35}
              tickFormatter={(s) =>
                String(s).length === 10 ? String(s).slice(5) : String(s)
              }
              tick={{ fontSize: 12 }}
            />
            <YAxis tickFormatter={compact} width={50} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => [fmt(v), label]} />
            <Area
              type="linear"
              dataKey={value}
              stroke={color}
              fill={"url(#fill" + value + ")"}
              strokeWidth={2.5}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>View chart data</summary>
        <Table
          rows={rows}
          columns={
            rows[0]?.rank
              ? [
                  ["rank", "Rank"],
                  ["artist_name", "Artist"],
                  ["share", "Cumulative share (%)"],
                ]
              : [
                  ["date", "UTC date"],
                  [value, label],
                  ...(rows[0]?.artists != null
                    ? [["artists", "Contributing artists"] as [string, string]]
                    : []),
                ]
          }
        />
      </details>
    </>
  );
}
function App() {
  const path = location.pathname.replace(/\/$/, "") || "/",
    detail = path.startsWith("/artists/") ? path.split("/")[2] : null;
  const page = detail ? "/artists" : path;
  const [params, setParams] = useState(new URLSearchParams(location.search));
  const [options, setOptions] = useState<Row | null>(null),
    [payload, setPayload] = useState<Row | null>(null),
    [quality, setQuality] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme !== "light",
  );
  const selected = (params.get("artists") || "").split(",").filter(Boolean);
  const query = new URLSearchParams(params);
  if (detail) query.set("artists", detail);
  const kind: Row = {
    "/": "overview",
    "/artists": "artists",
    "/attention": selected.length ? "comparisons" : "series",
    "/releases": "releases",
    "/context": "context",
    "/questions": "questions",
    "/methodology": "series",
  };
  const endpoint = detail ? "series" : kind[page] || "overview";
  function update(key: string, value: string) {
    const p = new URLSearchParams(location.search);
    value ? p.set(key, value) : p.delete(key);
    if (key !== "page") p.delete("page");
    history.replaceState(null, "", path + (p.size ? "?" + p : ""));
    setParams(p);
  }
  function drill(target: string, key: string, value: string) {
    const p = new URLSearchParams(params);
    p.delete("page");
    p.delete("q");
    p.set(key, value);
    location.href = target + "?" + p;
  }
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#011627" : "#fbfbfb");
    try {
      localStorage.setItem("atlas-owl-theme", dark ? "dark" : "light");
    } catch {
      /* Theme still works when browser storage is unavailable. */
    }
  }, [dark]);
  useEffect(() => {
    if (page === "/explore") return;
    fetch("/api/options")
      .then((r) => {
        if (!r.ok) throw Error("Could not load filter options");
        return r.json();
      })
      .then(setOptions)
      .catch((e) => setError(e.message));
    fetch("/api/quality")
      .then((r) => r.json())
      .then(setQuality)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (page === "/explore") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/" + endpoint + "?" + query, { signal: controller.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok)
          throw Error(
            typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail),
          );
        return j;
      })
      .then(setPayload)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, params.toString(), detail]);
  const d = payload?.data,
    meta = payload?.meta,
    artist = options?.artists.find((a: Row) => a.artist_mbid === detail);
  const exportUrl = (format: string) =>
    "/downloads/result/" + endpoint + "." + format + "?" + query;
  function artistLink(r: Row) {
    return (
      <a href={"/artists/" + r.artist_mbid + "?" + params}>{r.artist_name}</a>
    );
  }
  function comparison() {
    return (
      <>
        <div className="legend">
          {d.artists.map((a: Row) => (
            <span key={a.artist_mbid}>
              <i style={{ background: owlColor(a.color) }} />
              {a.artist_name} · {a.effective_days} effective days
            </span>
          ))}
        </div>
        <p className="hint">
          {d.mode === "common"
            ? `${d.effective_day_count} common observed dates`
            : "Available observed days per artist"}{" "}
          · {d.indexed ? "Observed median = 100" : "Absolute pageviews"}
          {d.smooth
            ? " · Trailing 7-day mean (requires consecutive observations)"
            : ""}
        </p>
        {d.effective_day_count === 0 && (
          <p className="empty">
            No common observed dates. Change artists or choose available-days
            mode.
          </p>
        )}
        <div
          className="chart large"
          role="img"
          aria-label="Artist daily attention comparison. Gaps indicate missing or excluded observations; values are available in the table."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={(d.artists[0]?.points || []).map((p: Row, i: number) => ({
                date: p.date,
                ...Object.fromEntries(
                  d.artists.map((a: Row) => [a.artist_mbid, a.points[i].value]),
                ),
              }))}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="date"
                tickFormatter={(s) => s.slice(5)}
                minTickGap={35}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={compact}
                width={60}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v, n) => [
                  fmt(v),
                  d.artists.find((a: Row) => a.artist_mbid === n)
                    ?.artist_name || n,
                ]}
              />
              {d.artists.map((a: Row, i: number) => (
                <Line
                  key={a.artist_mbid}
                  dataKey={a.artist_mbid}
                  stroke={owlColor(a.color)}
                  strokeDasharray={i % 2 ? "6 3" : undefined}
                  dot={false}
                  strokeWidth={2.3}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Table
          rows={d.artists}
          columns={[
            ["artist_name", "Artist", artistLink],
            ["total", "Effective total"],
            ["observed_days", "Observed days"],
            ["effective_days", "Compared days"],
            ["baseline", "Observed median"],
          ]}
        />
        <details>
          <summary>Daily comparison values</summary>
          <Table
            limit={500}
            rows={d.artists.flatMap((a: Row) =>
              a.points.map((p: Row) => ({ artist_name: a.artist_name, ...p })),
            )}
            columns={[
              ["artist_name", "Artist"],
              ["date", "UTC date"],
              ["value", d.indexed ? "Median index" : "Displayed views"],
              ["raw_views", "Observed views"],
              ["included", "Effective date"],
            ]}
          />
        </details>
      </>
    );
  }
  function heatmap() {
    return (
      <div className="heatmap-wrap">
        <div className="heatmap">
          {d.artists.map((a: Row) => (
            <div className="heat-row" key={a.artist_mbid}>
              <a href={"/artists/" + a.artist_mbid}>{a.artist_name}</a>
              <div className="heat-days">
                {a.points.map((p: Row) => {
                  const max = Math.max(
                    1,
                    ...a.points.map((x: Row) => x.raw_views || 0),
                  );
                  return (
                    <button
                      key={p.date}
                      className={p.raw_views === null ? "missing" : ""}
                      style={
                        p.raw_views === null
                          ? {}
                          : {
                              background: owlColor(a.color),
                              opacity: 0.25 + (0.75 * p.raw_views) / max,
                            }
                      }
                      aria-label={`${a.artist_name}, ${p.date}: ${fmt(p.raw_views)} views`}
                      title={`${p.date}: ${fmt(p.raw_views)} views`}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set("artists", a.artist_mbid);
                        next.set("start", p.date);
                        next.set("end", p.date);
                        location.href = "/attention?" + next;
                      }}
                    >
                      {p.raw_views === null ? "×" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="hint">
          Left to right: {meta.filters.start}–{meta.filters.end}. Intensity is
          relative to each artist’s maximum. × = missing, never zero. Focus a
          cell for its date and value.
        </p>
      </div>
    );
  }
  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-identity">
          <a href="/" className="brand">
            <span className="brand-mark">
              <AudioLines size={24} />
            </span>
            <span>
              Music Attention<span className="atlas">ATLAS</span>
            </span>
          </a>
          <button
            className="theme"
            role="switch"
            aria-checked={dark}
            aria-label="Night Owl dark theme"
            title={`Switch to ${dark ? "Light Owl" : "Night Owl"}`}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Moon size={17} /> : <Sun size={17} />}
            <span>{dark ? "Night Owl" : "Light Owl"}</span>
            <span className="theme-track" aria-hidden="true">
              <span />
            </span>
          </button>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([url, label, Icon]) => (
            <a
              aria-current={url === page ? "page" : undefined}
              className={url === page ? "active" : ""}
              href={url + "?" + params}
              key={url}
            >
              <Icon size={19} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </header>
      <main>
        <header className="topbar">
          <span>GLOBAL MUSIC / SNAPSHOT EXPLORER</span>
          <span className="snapshot-tag">
            {page === "/explore"
              ? "SOURCES & FURTHER READING"
              : options
                ? `${options.bounds[0]} — ${options.bounds[1]}`
                : "Loading snapshot…"}
          </span>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">MUSIC ATTENTION ATLAS</span>
              <h1>
                {detail
                  ? artist?.artist_name || "Artist"
                  : (titles[page] || titles["/"])[0]}
              </h1>
              <p>
                {detail
                  ? `${artist?.artist_type || "Unknown type"} · ${artist?.country || "Unknown country"} · ${artist?.disambiguation || "MusicBrainz identity"}`
                  : (titles[page] || titles["/"])[1]}
              </p>
            </div>
            {page !== "/explore" && (
              <a className="button export" href={exportUrl("csv")}>
                <Download size={16} /> Export rows
              </a>
            )}
          </div>
          {page !== "/explore" && (
            <div className="filters" aria-label="Dataset filters">
              <label>
                From
                <input
                  type="date"
                  value={params.get("start") || options?.bounds[0] || ""}
                  min={options?.bounds[0]}
                  max={options?.bounds[1]}
                  onChange={(e) => update("start", e.target.value)}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  value={params.get("end") || options?.bounds[1] || ""}
                  min={options?.bounds[0]}
                  max={options?.bounds[1]}
                  onChange={(e) => update("end", e.target.value)}
                />
              </label>
              <label>
                Artist country
                <select
                  value={params.get("country") || ""}
                  onChange={(e) => update("country", e.target.value)}
                >
                  <option value="">All countries</option>
                  {options?.countries.map((c: string) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Community tag
                <select
                  value={params.get("tag") || ""}
                  onChange={(e) => update("tag", e.target.value)}
                >
                  <option value="">All tags</option>
                  {options?.tags.map((t: string) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Coverage policy
                <select
                  value={params.get("coverage") || "available"}
                  onChange={(e) => update("coverage", e.target.value)}
                >
                  <option value="available">All available observations</option>
                  <option value="complete">Complete coverage only</option>
                </select>
              </label>
              <button
                className="reset"
                title="Reset all filters"
                onClick={() => {
                  history.replaceState(null, "", path);
                  setParams(new URLSearchParams());
                }}
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          )}
          {(page === "/attention" ||
            page === "/questions" ||
            page === "/releases" ||
            page === "/context" ||
            page === "/artists") &&
            !detail && (
              <div className="selection">
                <label>
                  Choose{" "}
                  {page === "/attention" || page === "/questions"
                    ? "up to 5 artists"
                    : "an artist"}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !selected.includes(e.target.value))
                        update(
                          "artists",
                          [...selected, e.target.value].join(","),
                        );
                    }}
                    disabled={selected.length >= 5}
                  >
                    <option value="">
                      {selected.length
                        ? "Add artist…"
                        : "All artists · select to narrow"}
                    </option>
                    {options?.artists.map((a: Row) => (
                      <option key={a.artist_mbid} value={a.artist_mbid}>
                        {a.artist_name}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.map((id) => (
                  <button
                    className="chip"
                    key={id}
                    onClick={() =>
                      update(
                        "artists",
                        selected.filter((x) => x !== id).join(","),
                      )
                    }
                  >
                    {options?.artists.find((a: Row) => a.artist_mbid === id)
                      ?.artist_name || id}{" "}
                    ×
                  </button>
                ))}
                {(page === "/attention" ||
                  (page === "/questions" &&
                    params.get("question") === "compare")) && (
                  <>
                    <label>
                      Compare over
                      <select
                        value={params.get("mode") || "common"}
                        onChange={(e) => update("mode", e.target.value)}
                      >
                        <option value="common">Common observed dates</option>
                        <option value="available">
                          Available days per artist
                        </option>
                      </select>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={params.get("indexed") === "true"}
                        onChange={(e) =>
                          update("indexed", String(e.target.checked))
                        }
                      />{" "}
                      Median index
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={params.get("smooth") === "true"}
                        onChange={(e) =>
                          update("smooth", String(e.target.checked))
                        }
                      />{" "}
                      7-day mean
                    </label>
                  </>
                )}
              </div>
            )}
          {page === "/explore" ? (
            <Explore />
          ) : loading ? (
            <div className="status" role="status">
              Loading captured observations…
            </div>
          ) : error ? (
            <div className="error" role="alert">
              {error}
              <p>Adjust the selection or reset filters.</p>
            </div>
          ) : (
            d && (
              <>
                <div className="scope">
                  <span>{meta.eligible_artists} included artists</span>
                  <span>{fmt(meta.observation_rows)} observed artist-days</span>
                  <span>
                    {meta.filters.start} – {meta.filters.end}
                  </span>
                  {selected.length > 0 && (
                    <span>{selected.length} artist filters active</span>
                  )}
                </div>
                {page === "/" && (
                  <>
                    <div className="stats">
                      <div>
                        <span>CAPTURED ATTENTION</span>
                        <strong>{fmt(d.total)}</strong>
                        <small>Wikipedia pageviews · selected window</small>
                      </div>
                      <div>
                        <span>ARTISTS IN SCOPE</span>
                        <strong>
                          {d.artist_count}
                          <em>/ {quality?.row_counts.artists}</em>
                        </strong>
                        <small>{meta.observed_artists} with observations</small>
                      </div>
                      <div>
                        <span>CAPTURED RELEASE EDITIONS</span>
                        <strong>{fmt(d.release_count)}</strong>
                        <small>Collection may be capped</small>
                      </div>
                      <div>
                        <span>ARTIST-DAY COVERAGE</span>
                        <strong>
                          {d.coverage == null
                            ? "—"
                            : (d.coverage * 100).toFixed(1) + "%"}
                        </strong>
                        <small>Observed / possible artist-days</small>
                      </div>
                    </div>
                    <div className="finding">
                      <span className="finding-icon">
                        <AudioLines />
                      </span>
                      <div>
                        <span className="eyebrow">IN THIS SELECTION</span>
                        <p>
                          {d.ranking[0]?.total != null ? (
                            <>
                              <a
                                href={
                                  "/attention?" +
                                  new URLSearchParams({
                                    ...Object.fromEntries(params),
                                    artists: d.ranking[0].artist_mbid,
                                  })
                                }
                              >
                                {d.ranking[0].artist_name}
                              </a>{" "}
                              leads captured attention with{" "}
                              <strong>{fmt(d.ranking[0].total)}</strong> views
                              across {d.ranking[0].observed_days} observed days.
                            </>
                          ) : (
                            "No observations match this selection."
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="grid">
                      <Panel
                        title="Where attention gathers"
                        sub="Artists ranked by captured pageviews"
                      >
                        <Bars
                          rows={d.ranking.filter((a: Row) => a.total !== null)}
                          label="artist_name"
                          limit={10}
                          onSelect={(a) =>
                            drill("/attention", "artists", a.artist_mbid)
                          }
                        />
                      </Panel>
                      <Panel
                        title="The daily pulse"
                        sub="Daily captured views · contributing artist counts in table"
                      >
                        <Trend rows={d.daily} />
                        <div className="note">
                          This is public attention to Wikipedia articles, not
                          streams, sales, chart position, or unique listeners.
                        </div>
                      </Panel>
                      <Panel
                        title="How concentrated is attention?"
                        sub={`${meta.observed_artists} observed artists · cumulative share of captured views`}
                      >
                        <Trend
                          rows={d.concentration}
                          value="share"
                          label="Cumulative share (%)"
                          color="var(--chart-1)"
                        />
                      </Panel>
                      <Panel
                        title="Read the snapshot carefully"
                        sub="Coverage is part of every result"
                      >
                        <div className="fact-list">
                          <a href="/methodology">
                            <strong>
                              {quality?.summary_missing_artists.length} artists
                              absent from supplied summary
                            </strong>
                            <span>
                              All dashboard metrics are recomputed from daily
                              rows.
                            </span>
                          </a>
                          <a href="/methodology">
                            <strong>
                              {quality?.possibly_capped_artists.length} release
                              sets have exactly 100 rows
                            </strong>
                            <span>
                              Captured editions cannot establish a complete
                              discography.
                            </span>
                          </a>
                          <a href="/methodology">
                            <strong>
                              Collected {d.collected_at[0]?.slice(0, 10)}
                            </strong>
                            <span>
                              Immutable snapshot · {d.collected_at[0]}
                            </span>
                          </a>
                        </div>
                      </Panel>
                    </div>
                  </>
                )}
                {page === "/artists" && !detail && (
                  <Panel
                    title="Artist directory"
                    sub="An em dash means no observations, not zero popularity."
                  >
                    <div className="inline-controls">
                      <label className="search">
                        <Search size={17} />
                        <input
                          placeholder="Search artist names"
                          aria-label="Search artist names"
                          value={params.get("q") || ""}
                          onChange={(e) => update("q", e.target.value)}
                        />
                      </label>
                      <label>
                        Sort
                        <select
                          value={params.get("sort") || "attention"}
                          onChange={(e) => update("sort", e.target.value)}
                        >
                          <option value="attention">Captured attention</option>
                          <option value="name">Name</option>
                          <option value="coverage">Coverage</option>
                        </select>
                      </label>
                    </div>
                    <Table
                      rows={d.rows}
                      columns={[
                        [
                          "artist_name",
                          "Artist",
                          (r) => (
                            <div className="artist-cell">
                              <span
                                className="initials"
                                style={{ color: owlColor(r.color) }}
                              >
                                {r.artist_name
                                  .split(" ")
                                  .map((s: string) => s[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <div>
                                {artistLink(r)}
                                <small>
                                  {r.disambiguation || r.artist_type}
                                </small>
                              </div>
                            </div>
                          ),
                        ],
                        ["country", "Country"],
                        ["total", "Captured views"],
                        ["observed_days", "Observed days"],
                        [
                          "coverage",
                          "Coverage",
                          (r) => (r.coverage * 100).toFixed(1) + "%",
                        ],
                        [
                          "tags",
                          "Tags",
                          (r) => (
                            <div className="tags">
                              {r.tags_list.slice(0, 3).map((t: string) => (
                                <button
                                  key={t}
                                  onClick={() => drill("/context", "tag", t)}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          ),
                        ],
                      ]}
                    />
                    <Pagination
                      count={d.count}
                      params={params}
                      update={update}
                    />
                  </Panel>
                )}
                {detail && artist && (
                  <>
                    <div className="detail-meta">
                      <span>MBID: {detail}</span>
                      <a href={artist.source_url}>MusicBrainz source</a>
                      <span>
                        Birth / formation: {artist.begin_date || "Unknown"}
                      </span>
                    </div>
                    <div className="tags">
                      {artist.tags_list.map((t: string) => (
                        <button
                          key={t}
                          onClick={() => drill("/context", "tag", t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <Panel
                      title="Observed daily attention"
                      sub="No interpolation across missing dates."
                    >
                      {comparison()}
                      <p className="hint">
                        Peak:{" "}
                        {d.artists[0]?.points.reduce(
                          (a: Row, p: Row) =>
                            p.raw_views != null &&
                            (a.raw_views == null || p.raw_views > a.raw_views)
                              ? p
                              : a,
                          { raw_views: null },
                        ).date || "No observations"}{" "}
                        · Coverage: {d.artists[0]?.observed_days || 0}/
                        {meta.calendar_days} calendar days. Observed-day mean:{" "}
                        {fmt(
                          d.artists[0]?.observed_days
                            ? d.artists[0].total / d.artists[0].observed_days
                            : null,
                        )}
                        .
                      </p>
                    </Panel>
                    <ArtistSources id={detail} />
                    <a className="button" href={"/releases?artists=" + detail}>
                      Explore captured releases
                    </a>
                  </>
                )}
                {page === "/attention" && (
                  <>
                    <Panel
                      title={
                        selected.length
                          ? "Artist comparison"
                          : "Daily attention across the sample"
                      }
                      sub={
                        selected.length
                          ? "Comparisons use the common observed dates by default."
                          : "Select artists above to compare up to five series."
                      }
                    >
                      {selected.length ? (
                        comparison()
                      ) : (
                        <Trend rows={d.daily} />
                      )}
                    </Panel>
                    <Panel
                      title="The coverage and attention grid"
                      sub="One cell per artist per UTC day"
                    >
                      {heatmap()}
                    </Panel>
                    <Panel
                      title="Explore relative spikes"
                      sub="Current views / preceding 7-day median. Descriptive signal, not statistical significance or proof of an event."
                    >
                      <Table
                        rows={d.spikes.filter((r: Row) => r.ratio != null)}
                        columns={[
                          ["artist_name", "Artist", artistLink],
                          ["date", "Date"],
                          ["views", "Views"],
                          ["baseline", "Prior median"],
                          ["ratio", "Ratio (×)"],
                          ["excess", "Absolute excess"],
                        ]}
                      />
                      <p className="hint">
                        {d.spikes.filter((r: Row) => r.ratio == null).length}{" "}
                        observations lack a supported positive baseline.
                      </p>
                    </Panel>
                  </>
                )}
                {page === "/releases" && (
                  <>
                    <div className="inline-controls">
                      <label>
                        Search editions
                        <input
                          value={params.get("q") || ""}
                          placeholder="Title or artist"
                          onChange={(e) => update("q", e.target.value)}
                        />
                      </label>
                      <label>
                        Release year
                        <input
                          type="number"
                          placeholder="All years"
                          min="1"
                          max="9999"
                          value={params.get("year") || ""}
                          onChange={(e) => update("year", e.target.value)}
                        />
                      </label>
                      <label>
                        Group editions by
                        <select
                          value={params.get("group") || "year"}
                          onChange={(e) => update("group", e.target.value)}
                        >
                          {[
                            ["year", "Release year"],
                            ["release_country", "Release territory"],
                            ["release_status", "Status"],
                            ["release_packaging", "Packaging"],
                            ["release_language", "Language"],
                            ["precision", "Date precision"],
                          ].map(([v, l]) => (
                            <option value={v} key={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="note">
                      {fmt(d.distinct_editions)} distinct captured editions ·{" "}
                      {d.undated} with unknown year ·{" "}
                      {d.possibly_capped_artists.length} artist sets possibly
                      capped. Attention dates affect artist coverage
                      eligibility, not release dates. Release territory is not
                      artist country.
                    </div>
                    <Panel
                      title="Patterns in the collection"
                      sub="Distinct release MBIDs in the filtered captured rows"
                    >
                      <Bars
                        rows={d.bars}
                        limit={100}
                        onSelect={
                          !params.get("group") || params.get("group") === "year"
                            ? (r) => update("year", r.name)
                            : undefined
                        }
                      />
                    </Panel>
                    <Panel
                      title="Captured release editions"
                      sub={`${fmt(d.count)} matching rows · partial dates are preserved`}
                    >
                      <Table
                        rows={d.rows}
                        columns={[
                          [
                            "release_title",
                            "Edition",
                            (r) => <a href={r.source_url}>{r.release_title}</a>,
                          ],
                          ["artist_name", "Artist", artistLink],
                          ["release_date", "Date as supplied"],
                          ["precision", "Precision"],
                          ["release_country", "Territory"],
                          ["release_status", "Status"],
                          ["release_packaging", "Packaging"],
                          ["release_language", "Language"],
                          ["release_barcode", "Barcode"],
                        ]}
                      />
                      <Pagination
                        count={d.count}
                        params={params}
                        update={update}
                      />
                    </Panel>
                  </>
                )}
                {page === "/context" && (
                  <>
                    <div className="note">
                      Geography describes artist metadata, not where listeners
                      live. Tags are overlapping community labels. Their
                      attention totals are not exclusive shares.
                    </div>
                    <div className="grid">
                      <Panel
                        title="Represented countries"
                        sub="Captured views by recorded artist country"
                      >
                        <Bars
                          rows={d.countries}
                          limit={50}
                          onSelect={(r) => drill("/artists", "country", r.name)}
                        />
                        <Table
                          rows={d.countries}
                          columns={[
                            ["name", "Country"],
                            ["artists", "Artists"],
                            ["observed_artists", "With observations"],
                            ["total", "Captured views"],
                          ]}
                        />
                      </Panel>
                      <Panel
                        title="Shared community tags"
                        sub={`Tags among ${meta.eligible_artists} included ${meta.eligible_artists === 1 ? "artist" : "artists"}. An artist can belong to several tags.`}
                      >
                        <div className="inline-controls">
                          <label>
                            Tag metric
                            <select
                              value={params.get("tag_metric") || "artists"}
                              onChange={(e) =>
                                update("tag_metric", e.target.value)
                              }
                            >
                              <option value="artists">Artist count</option>
                              <option value="total">Captured pageviews</option>
                            </select>
                          </label>
                          <label>
                            Find a tag
                            <input
                              type="search"
                              value={params.get("tag_search") || ""}
                              placeholder="e.g. rapper or pop soul"
                              onChange={(e) =>
                                update("tag_search", e.target.value)
                              }
                            />
                          </label>
                        </div>
                        {(selected.length > 0 || params.get("tag")) && (
                          <p className="note">
                            Artist or tag filters narrow this panel. Tags shared
                            by the same included artists have identical counts
                            and pageview totals. Remove the filter chips above
                            or use Reset to compare the full sample.
                          </p>
                        )}
                        <Bars
                          rows={d.tags}
                          limit={15}
                          value={params.get("tag_metric") || "artists"}
                          unit={
                            params.get("tag_metric") === "total"
                              ? "views"
                              : "artists"
                          }
                          detail={(r) =>
                            params.get("tag_metric") === "total"
                              ? `${r.artists} ${r.artists === 1 ? "artist" : "artists"} · ${r.observed_artists} with observations`
                              : `${fmt(r.total)} captured views · ${r.observed_artists} with observations`
                          }
                          onSelect={(r) => drill("/artists", "tag", r.name)}
                        />
                        <p className="hint">
                          Showing {Math.min(15, d.tags.length)} of{" "}
                          {d.tags.length} matching tags, ranked by{" "}
                          {params.get("tag_metric") === "total"
                            ? "captured pageviews"
                            : "artist count"}
                          . These are artist memberships, not tag votes or
                          listener counts.
                        </p>
                        <a
                          href={
                            "/downloads/result/context.csv?" +
                            new URLSearchParams({
                              ...Object.fromEntries(params),
                              dimension: "tags",
                            })
                          }
                        >
                          Download matching tag counts and views
                        </a>
                        <details>
                          <summary>Tag sample sizes and values</summary>
                          <Table
                            rows={d.tags}
                            limit={1000}
                            columns={[
                              [
                                "name",
                                "Tag",
                                (r) => (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      drill("/artists", "tag", r.name)
                                    }
                                  >
                                    {r.name}
                                  </button>
                                ),
                              ],
                              ["artists", "Artists"],
                              ["observed_artists", "With observations"],
                              ["total", "Captured views"],
                            ]}
                          />
                        </details>
                      </Panel>
                    </div>
                  </>
                )}
                {page === "/questions" && (
                  <>
                    <div className="question-buttons">
                      {[
                        ["attention", "Who received the most attention?"],
                        ["spike", "Who had the largest relative spike?"],
                        ["concentration", "How concentrated is attention?"],
                        ["compare", "How do my selected artists compare?"],
                        ["countries", "Which countries are represented?"],
                        ["tags", "Which tags are represented?"],
                        ["missing", "Where is the data incomplete?"],
                        [
                          "unsupported",
                          "What about sales, listeners, or causes?",
                        ],
                      ].map(([v, l]) => (
                        <button
                          className={
                            (params.get("question") || "attention") === v
                              ? "selected"
                              : ""
                          }
                          key={v}
                          onClick={() => update("question", v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <Panel
                      title="What the data says"
                      sub="Deterministic answer for the effective filters above"
                    >
                      {d.artists ? (
                        comparison()
                      ) : (
                        <>
                          <p className="answer">{d.answer}</p>
                          {d.rows.length > 0 && (
                            <>
                              <Bars
                                rows={d.rows.map((r: Row) => ({
                                  ...r,
                                  name: r.artist_name || r.name,
                                  total:
                                    r.ratio ??
                                    r.share ??
                                    r.total ??
                                    r.missing_days,
                                }))}
                                limit={10}
                              />
                              <Table
                                rows={d.rows}
                                columns={Object.keys(d.rows[0])
                                  .filter((k) => k !== "artist_mbid")
                                  .map((k) => [k, k.replaceAll("_", " ")])}
                              />
                            </>
                          )}
                        </>
                      )}
                    </Panel>
                  </>
                )}
                {page === "/methodology" && quality && (
                  <>
                    <div className="note">
                      This is a collected sample, not a comprehensive picture of
                      global music demand. No raw API responses or collector
                      code were supplied. Dataset reuse licensing is unknown; no
                      license has been invented.
                    </div>
                    <div className="grid">
                      <Panel
                        title="Source files & provenance"
                        sub="Untouched original CSV downloads preserve exact source bytes"
                      >
                        {Object.keys(quality.source_hashes).map((name) => (
                          <div className="source-file" key={name}>
                            <a href={"/downloads/original/" + name}>
                              <Download size={15} />
                              {name}
                            </a>
                            <code>{quality.source_hashes[name]}</code>
                          </div>
                        ))}
                        <a href="/downloads/manifest.json">
                          Download SHA-256 manifest
                        </a>
                        <p>
                          Supplied attribution: MusicBrainz artist/release
                          metadata, Wikimedia pageviews, collector timestamps.
                          Wikipedia links on artist pages are constructed
                          article links; source slugs are preserved.
                        </p>
                        <p>
                          <a href="https://musicbrainz.org/doc/About/Data_License">
                            MusicBrainz licensing
                          </a>{" "}
                          distinguishes CC0 core data from CC BY-NC-SA 3.0
                          supplementary data. No license was supplied for this
                          combined dataset.
                        </p>
                      </Panel>
                      <Panel title="Transformations & limitations">
                        {quality.transformations.map((x: string) => (
                          <p key={x}>{x}</p>
                        ))}
                        {quality.dictionary_notes.map((x: string) => (
                          <p className="hint" key={x}>
                            {x}
                          </p>
                        ))}
                        <div className="downloads">
                          {["artists", "pageviews", "releases"].map((t) => (
                            <a
                              key={t}
                              href={"/downloads/cleaned/" + t + ".csv?" + query}
                            >
                              Cleaned {t} CSV
                            </a>
                          ))}
                        </div>
                      </Panel>
                      <Panel
                        title="Supplied summary disagreements"
                        sub={`${quality.summary_missing_artists.length} artists are absent from the supplied summary.`}
                      >
                        <Table
                          rows={quality.summary_disagreements}
                          limit={100}
                          columns={[
                            ["artist", "Artist"],
                            ["field", "Field"],
                            ["supplied", "Supplied"],
                            ["recomputed", "Recomputed"],
                          ]}
                        />
                        <details>
                          <summary>
                            Artists omitted from supplied summary
                          </summary>
                          <p>{quality.summary_missing_artists.join(", ")}</p>
                        </details>
                      </Panel>
                      <Panel
                        title="Dictionary discrepancies"
                        sub="Actual CSV headers govern ingestion."
                      >
                        <Table
                          rows={quality.dictionary_discrepancies}
                          columns={[
                            ["table", "Table"],
                            ["column", "Described field absent from CSV"],
                            ["description", "Dictionary description"],
                          ]}
                        />
                        <p>
                          {quality.possibly_capped_artists.length} artist
                          collections contain exactly 100 release rows. All
                          track counts are zero and unsuitable for analysis.
                        </p>
                        <details>
                          <summary>Possibly capped collections</summary>
                          <p>{quality.possibly_capped_artists.join(", ")}</p>
                        </details>
                      </Panel>
                      <Panel title="Actual schemas & missing fields" wide>
                        {Object.entries(quality.missingness).map(
                          ([table, fields]) => (
                            <details key={table}>
                              <summary>
                                {table} · {quality.row_counts[table]} source
                                rows
                              </summary>
                              <Table
                                limit={100}
                                rows={Object.entries(fields as Row).map(
                                  ([field, missing]) => ({ field, missing }),
                                )}
                                columns={[
                                  ["field", "Field"],
                                  ["missing", "Blank source values"],
                                ]}
                              />
                            </details>
                          ),
                        )}
                      </Panel>
                      <Panel title="Audited identity joins" wide>
                        <Table
                          rows={quality.identity_matches}
                          limit={100}
                          columns={[
                            ["artist_name", "Source name"],
                            ["artist_mbid", "Matched MBID"],
                            ["method", "Match method"],
                          ]}
                        />
                      </Panel>
                    </div>
                    <Panel
                      title="Artist-day coverage"
                      sub="Absent days stay missing throughout calculations."
                    >
                      {heatmap()}
                    </Panel>
                  </>
                )}
                <details className="calculation">
                  <summary>
                    How calculated · effective filters & export metadata
                  </summary>
                  <p>{Object.values(meta.definitions).join(" ")}</p>
                  <p>
                    Source tables: {meta.source_tables.join(", ")}. Coverage
                    policy: {meta.coverage_policy}. Observed rows:{" "}
                    {meta.observation_rows}.
                  </p>
                  <pre>{JSON.stringify(meta.filters, null, 2)}</pre>
                  <a href={exportUrl("json")}>
                    Download result with full metadata and source hashes
                  </a>
                </details>
              </>
            )
          )}
          <footer>
            <span>Music Attention Atlas</span>
            <p>A captured sample, with its gaps intact.</p>
            <a href="/methodology">Sources & methodology</a>
            <a
              className="footer-credit"
              href="https://aurodemo-production.up.railway.app"
            >
              by William Rawls &amp; ChatGPT. Dataset from Kaggle
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Pagination({
  count,
  params,
  update,
}: {
  count: number;
  params: URLSearchParams;
  update: (k: string, v: string) => void;
}) {
  const page = Number(params.get("page") || 1),
    limit = Number(params.get("limit") || 50);
  return (
    <div className="pagination">
      <span>
        {fmt(count)} rows · page {page} of{" "}
        {Math.max(1, Math.ceil(count / limit))}
      </span>
      <button
        disabled={page <= 1}
        onClick={() => update("page", String(page - 1))}
      >
        Previous
      </button>
      <button
        disabled={page * limit >= count}
        onClick={() => update("page", String(page + 1))}
      >
        Next
      </button>
    </div>
  );
}
function ArtistSources({ id }: { id: string }) {
  const [rows, setRows] = useState<Row | null>(null),
    [err, setErr] = useState("");
  useEffect(() => {
    Promise.all(
      [
        "/api/options",
        "/api/series?artists=" + id,
        "/api/releases?artists=" + id + "&limit=10",
      ].map((u) =>
        fetch(u).then((r) => {
          if (!r.ok) throw Error("Could not load artist source details");
          return r.json();
        }),
      ),
    )
      .then(([o, s, r]) =>
        setRows({
          artist: o.artists.find((a: Row) => a.artist_mbid === id),
          series: s.data.artists[0],
          releases: r.data,
        }),
      )
      .catch((e) => setErr(e.message));
  }, [id]);
  return (
    <>
      <details>
        <summary>Identity, aliases & article sources</summary>
        {err && <p role="alert">{err}</p>}
        <p>{rows?.artist.aliases_list.join("; ") || "No aliases supplied"}</p>
        {rows?.series?.source_slugs.map((s: string, i: number) => (
          <p key={s}>
            Preserved source slug: <code>{s}</code> ·{" "}
            <a href={rows.series.article_links[i]}>
              Constructed Wikipedia article link
            </a>
          </p>
        ))}
        <p>
          These article links are constructed from preserved slugs. Original API
          request URLs were not supplied.
        </p>
      </details>
      {rows && (
        <Panel
          title="Captured releases for this identity"
          sub={`First 10 of ${rows.releases.count} captured editions · all captured years, independent of the pageview date window`}
        >
          <Table
            rows={rows.releases.rows}
            columns={[
              [
                "release_title",
                "Edition",
                (r) => <a href={r.source_url}>{r.release_title}</a>,
              ],
              ["release_date", "Date as supplied"],
              ["precision", "Precision"],
              ["release_country", "Territory"],
            ]}
          />
        </Panel>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
