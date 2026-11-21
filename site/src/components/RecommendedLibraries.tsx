// The recommended-libraries page (project/recommended-libraries): every entry of recs/libraries.ts
// as a card, with search, category and "pairs with xtandard" filters, and the license and latest
// release recorded by `bun run recs:check` (recs/status.json). Rendered at build time, so the full
// list is in the HTML (and the search index); hydrated for filtering. Filters live in the query
// string (?q=cache&category=caching&show=pairs) so a filtered view can be linked.
/// <reference types="astro/client" />
import { useEffect, useMemo, useState } from "react";
import { libraries } from "../../../recs/libraries.ts";
import {
  categories,
  classifyLicense,
  monthsBetween,
  npmUrl,
  quietReleaseMonths,
  repoUrl,
  type PackageStatus,
  type Recommendation,
  type StatusFile,
} from "../../../recs/schema.ts";
import statusJson from "../../../recs/status.json";

const status = statusJson as StatusFile;
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
const categoryLabel = new Map<string, string>(categories.map((c) => [c.id, c.label]));

type Show = "all" | "pairs" | "attention";
type Sort = "category" | "name" | "release";

/** `@xtandard/lib/filters/drizzle` → the API reference overview of that entry point. */
const apiRoute = (module: string) =>
  `${base}/api/${module === "@xtandard/lib" ? "core" : module.slice("@xtandard/lib/".length)}/`;

/** What needs a reader's attention: the entry's own caveat plus what the last check saw. */
function warnings(lib: Recommendation, s: PackageStatus | undefined): string[] {
  const out: string[] = [];
  if (s?.deprecated) out.push(`Deprecated on npm: ${s.deprecated}`);
  if (s?.archived) out.push("The GitHub repository is archived.");
  if (lib.caveat) out.push(lib.caveat);
  return out;
}

const quiet = (lib: Recommendation, s: PackageStatus | undefined) =>
  !lib.stable && !!s?.released && monthsBetween(s.released, status.checkedAt) >= quietReleaseMonths;

const haystack = (lib: Recommendation) =>
  [
    lib.name,
    lib.npm,
    lib.repo,
    lib.provides,
    lib.why,
    lib.insteadOf,
    lib.license,
    categoryLabel.get(lib.category),
    ...(lib.pairsWith ?? []).flatMap((p) => [p.module, p.how]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const index = libraries.map((lib) => ({
  lib,
  text: haystack(lib),
  status: status.packages[lib.npm],
}));

function Card({
  lib,
  s,
  showCategory,
}: {
  lib: Recommendation;
  s?: PackageStatus;
  showCategory: boolean;
}) {
  const license = classifyLicense(lib.license);
  const notes = warnings(lib, s);
  return (
    <article className="xt-rec" id={`lib-${lib.npm.replace(/[@/]/g, "")}`}>
      <header>
        <h3>
          <a href={lib.docs ?? repoUrl(lib.repo)}>{lib.name}</a>
        </h3>
        <div className="xt-badges">
          <span className={`xt-badge xt-license-${license}`} title={`License (${license})`}>
            {lib.license}
          </span>
          {s ? (
            <span
              className={`xt-badge${quiet(lib, s) ? " xt-quiet" : ""}`}
              title={
                quiet(lib, s) ? `No release for ${quietReleaseMonths}+ months` : "Latest release"
              }
            >
              v{s.version} · {s.released}
            </span>
          ) : null}
          {lib.stable ? (
            <span className="xt-badge" title={lib.stable}>
              stable
            </span>
          ) : null}
          {showCategory ? (
            <span className="xt-badge">{categoryLabel.get(lib.category)}</span>
          ) : null}
        </div>
      </header>
      <p className="xt-provides">{lib.provides}</p>
      <p className="xt-why">{lib.why}</p>
      {lib.insteadOf ? (
        <p className="xt-meta">
          <strong>Instead of:</strong> {lib.insteadOf}
        </p>
      ) : null}
      {(lib.pairsWith ?? []).map((p) => (
        <div className="xt-pair" key={p.module}>
          <p>
            <strong>Pairs with</strong>{" "}
            <a href={apiRoute(p.module)}>
              <code>{p.module}</code>
            </a>
            : {p.how}
          </p>
          {p.example ? (
            <details>
              <summary>Example</summary>
              <pre>
                <code>{p.example}</code>
              </pre>
            </details>
          ) : null}
        </div>
      ))}
      {notes.length ? (
        <ul className="xt-warn">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <footer>
        <code>npm i {lib.npm}</code>
        <span>
          <a href={repoUrl(lib.repo)}>GitHub</a> · <a href={npmUrl(lib.npm)}>npm</a>
          {lib.docs ? (
            <>
              {" "}
              · <a href={lib.docs}>docs</a>
            </>
          ) : null}
        </span>
      </footer>
    </article>
  );
}

export default function RecommendedLibraries() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [show, setShow] = useState<Show>("all");
  const [sort, setSort] = useState<Sort>("category");

  // Read the filters from the URL after hydration (the HTML is rendered unfiltered).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery(p.get("q") ?? "");
    const c = p.get("category");
    if (c && categoryLabel.has(c)) setCategory(c);
    const sh = p.get("show");
    if (sh === "pairs" || sh === "attention") setShow(sh);
    const so = p.get("sort");
    if (so === "name" || so === "release") setSort(so);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category !== "all") p.set("category", category);
    if (show !== "all") p.set("show", show);
    if (sort !== "category") p.set("sort", sort);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [query, category, show, sort]);

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = index.filter(
      ({ lib, text, status: s }) =>
        (category === "all" || lib.category === category) &&
        (show !== "pairs" || (lib.pairsWith?.length ?? 0) > 0) &&
        (show !== "attention" || warnings(lib, s).length > 0 || quiet(lib, s)) &&
        words.every((w) => text.includes(w)),
    );
    if (sort === "name")
      out.sort((a, b) => a.lib.name.localeCompare(b.lib.name, "en", { sensitivity: "base" }));
    if (sort === "release")
      out.sort((a, b) => (b.status?.released ?? "").localeCompare(a.status?.released ?? ""));
    return out;
  }, [query, category, show, sort]);

  const grouped = sort === "category";
  const groups = grouped
    ? categories
        .map((c) => ({
          c,
          items: visible
            .filter((v) => v.lib.category === c.id)
            .sort((a, b) => a.lib.name.localeCompare(b.lib.name, "en", { sensitivity: "base" })),
        }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="xt-play xt-recs not-content">
      <div className="xt-row">
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="cache, retry, temporal, @xtandard/lib/filters…"
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select value={show} onChange={(e) => setShow(e.target.value as Show)}>
            <option value="all">All libraries</option>
            <option value="pairs">Pairs with an xtandard module</option>
            <option value="attention">Needs attention (caveats, quiet)</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="category">By category</option>
            <option value="name">By name</option>
            <option value="release">By latest release</option>
          </select>
        </label>
      </div>
      <p className="xt-hint" aria-live="polite">
        {visible.length === libraries.length
          ? `${libraries.length} libraries.`
          : `${visible.length} of ${libraries.length} libraries.`}{" "}
        License and latest release as of {status.checkedAt}.
      </p>
      {visible.length === 0 ? <p>No library matches these filters.</p> : null}
      {grouped
        ? groups.map(({ c, items }) => (
            <section key={c.id} className="xt-rec-group">
              <h2 id={c.id}>{c.label}</h2>
              <p className="xt-hint">{c.blurb}</p>
              {items.map(({ lib, status: s }) => (
                <Card key={lib.npm} lib={lib} s={s} showCategory={false} />
              ))}
            </section>
          ))
        : visible.map(({ lib, status: s }) => <Card key={lib.npm} lib={lib} s={s} showCategory />)}
    </div>
  );
}
