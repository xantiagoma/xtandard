// The site's information architecture: which repository Markdown becomes which page, and the
// sidebar tree. scripts/sync.ts reads it to write src/content/docs/, and astro.config.ts reads it
// to build the sidebar, so a page and its sidebar entry cannot drift.
//
// The Markdown in the repository (README.md, docs/*.md) stays the single source of truth: it is
// what GitHub and npm render. A page is one of:
//   - a whole repository file (`src`);
//   - some H2 sections of one (`src` + `sections`, optionally `intro` for the text above the first
//     H2) — how the long guides are split into several pages. Every H2 of a split file must land
//     on exactly one page, so a new section cannot silently disappear from the site;
//   - a page written for the site only (`site`, relative to site/content/).
// Plain Node APIs only: Astro loads this file through Vite.
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));
export const repoUrl = "https://github.com/xantiagoma/xtandard";
export const npmUrl = "https://www.npmjs.com/package/@xtandard/lib";
export const branch = "main";
/**
 * Where the site is served: the project site of xantiagoma.github.io, under the account's custom
 * domain. pages.yml passes what actions/configure-pages reports (SITE_ORIGIN, SITE_BASE), so a
 * domain change needs no code change.
 */
export const siteOrigin = process.env.SITE_ORIGIN || "https://me.xantiagoma.com";
export const siteBase = (process.env.SITE_BASE || "/xtandard").replace(/\/+$/, "");

export type Page = {
  /** Route without the base and without slashes; "" is the home page. */
  slug: string;
  /** Sidebar label; the page title when absent. */
  label?: string;
  /** Repository file the page is built from. */
  src?: string;
  /** Only these H2 sections of `src` (by heading text, in file order). */
  sections?: string[];
  /** With `sections`: also the H1 and the text above the first H2. */
  intro?: boolean;
  /** Page title when it does not come from the source's H1. */
  title?: string;
  /** Site-only page in site/content/ (.md or .mdx). */
  site?: string;
  /** Contributor-only material: a banner says so and search skips it. */
  internal?: boolean;
};
export type Link = { label: string; link: string };
export type Group = { label: string; collapsed?: boolean; items: Item[] };
export type Item = Page | Link | Group;

export const home: Page = { slug: "", site: "index.mdx" };

export const sidebar: Item[] = [
  {
    label: "Start here",
    items: [
      { slug: "getting-started", site: "getting-started.md", label: "Getting started" },
      {
        slug: "guides/entry-points",
        src: "README.md",
        sections: ["Entry Points"],
        title: "Entry points",
        label: "Entry points",
      },
      {
        slug: "guides/sync-async-adaptive",
        src: "docs/sync-async-adaptive.md",
        label: "Sync/async-adaptive APIs",
      },
    ],
  },
  {
    label: "Core",
    items: [
      { slug: "core", site: "core/index.md", label: "Overview" },
      { slug: "core/error-handling", site: "core/error-handling.md", label: "Error handling" },
      { slug: "core/async", site: "core/async.md", label: "Async" },
      { slug: "core/iterables", site: "core/iterables.md", label: "Iterables & generators" },
      { slug: "core/type-guards", site: "core/type-guards.md", label: "Type guards" },
      { slug: "core/disposables", site: "core/disposables.md", label: "Disposables" },
      { slug: "core/strings", site: "core/strings.md", label: "Strings" },
      { slug: "core/misc", site: "core/misc.md", label: "Misc" },
    ],
  },
  {
    label: "Interval",
    items: [
      {
        slug: "interval",
        src: "docs/INTERVAL.md",
        intro: true,
        sections: ["Built-in interval types", "Construction", "Operations", "String form"],
        label: "Overview",
      },
      {
        slug: "interval/sets",
        src: "docs/INTERVAL.md",
        title: "Interval sets and maps",
        sections: ["Interval sets and maps"],
        label: "Sets & maps",
      },
      {
        slug: "interval/domains",
        src: "docs/INTERVAL.md",
        title: "Interval domains",
        sections: [
          "Temporal intervals",
          "Decimal intervals",
          "Fraction intervals",
          "Money intervals",
          "String intervals",
          "Ordinal intervals",
          "Semver intervals",
          "IP intervals",
        ],
        label: "Domains",
      },
      {
        slug: "interval/semantics",
        src: "docs/INTERVAL.md",
        title: "Interval semantics and custom types",
        sections: [
          'Discrete vs continuous (the "epsilon")',
          "Extended real line (`±∞`)",
          "Edge cases",
          "`instanceof` & element-type safety",
          "Custom types",
        ],
        label: "Semantics & custom types",
      },
      { slug: "playground/interval", site: "playground/interval.mdx", label: "Playground" },
    ],
  },
  {
    label: "Pagination",
    items: [
      {
        slug: "pagination",
        src: "docs/PAGINATION.md",
        intro: true,
        sections: ["Quick start", "Choosing a pagination style", "Core concepts"],
        label: "Overview",
      },
      {
        slug: "pagination/data-sources",
        src: "docs/PAGINATION.md",
        title: "Pagination: data source recipes",
        sections: ["Data source recipes (backend)"],
        label: "Data source recipes",
      },
      {
        slug: "pagination/serving",
        src: "docs/PAGINATION.md",
        title: "Pagination: serving endpoints",
        sections: ["Serving it (backend endpoints)", "Cursor codecs", "Security", "Error contract"],
        label: "Serving & cursors",
      },
      {
        slug: "pagination/frontend",
        src: "docs/PAGINATION.md",
        title: "Pagination: frontend and iteration",
        sections: ["Iterating everything — `pages()` / `items()`", "Frontend"],
        label: "Frontend & iteration",
      },
      {
        slug: "pagination/reference",
        src: "docs/PAGINATION.md",
        title: "Pagination: reference",
        sections: [
          "Sync/async tiers",
          "Performance",
          "Migration",
          "Testing",
          "API reference",
          "Gotchas & FAQ",
        ],
        label: "Reference & FAQ",
      },
    ],
  },
  {
    label: "Filters",
    items: [
      {
        slug: "filters",
        src: "docs/FILTERS.md",
        intro: true,
        sections: [
          "Quick start",
          "The model",
          "Validation — ready-made schemas (or bring your own)",
          "The `date` kind is injected",
        ],
        label: "Overview",
      },
      {
        slug: "filters/adapters",
        src: "docs/FILTERS.md",
        title: "Filters: compiler and database adapters",
        sections: ["The portable compiler", "Adapters", "Writing your own adapter"],
        label: "Compiler & adapters",
      },
      {
        slug: "filters/ui",
        src: "docs/FILTERS.md",
        title: "Filters: sorting, URLs and UI",
        sections: [
          "Sorting",
          "Compact URL encoding",
          "Describing filters (chip labels)",
          "Resource metadata (backend-driven UIs)",
        ],
        label: "Sorting, URLs & UI",
      },
      {
        slug: "filters/tanstack-table",
        src: "docs/FILTERS.md",
        title: "Filters: TanStack Table",
        sections: ["TanStack Table"],
        label: "TanStack Table",
      },
      {
        slug: "filters/end-to-end",
        src: "docs/FILTERS.md",
        title: "Filters: a REST list endpoint, end to end",
        sections: ["End-to-end: a REST list endpoint"],
        label: "End-to-end endpoint",
      },
      {
        slug: "filters/reference",
        src: "docs/FILTERS.md",
        title: "Filters: reference",
        sections: ["Security", "API reference", "Gotchas & FAQ"],
        label: "Reference & FAQ",
      },
      { slug: "playground/filters", site: "playground/filters.mdx", label: "Playground" },
      { slug: "playground/table", site: "playground/table.mdx", label: "Table playground" },
    ],
  },
  {
    label: "TanStack URL state",
    items: [{ slug: "tanstack", src: "docs/TANSTACK.md", label: "Overview" }],
  },
  {
    label: "Integrations",
    items: [
      { slug: "integrations/web", site: "integrations/web.md", label: "Web" },
      { slug: "integrations/react", site: "integrations/react.md", label: "React" },
      { slug: "integrations/sonner", site: "integrations/sonner.md", label: "Sonner" },
      { slug: "integrations/temporal", site: "integrations/temporal.md", label: "Temporal" },
      { slug: "integrations/ulid", site: "integrations/ulid.md", label: "ULID" },
      { slug: "integrations/dataloader", site: "integrations/dataloader.md", label: "DataLoader" },
      { slug: "integrations/unstorage", site: "integrations/unstorage.md", label: "unstorage" },
      {
        slug: "integrations/schemas",
        site: "integrations/schemas.md",
        label: "Validation schemas",
      },
    ],
  },
  {
    label: "Tutorials",
    items: [
      { slug: "tutorials", site: "tutorials/index.md", label: "Overview" },
      {
        slug: "tutorials/filterable-list",
        site: "tutorials/filterable-list.md",
        label: "A filterable, paginated list",
      },
      {
        slug: "tutorials/streaming-ui",
        site: "tutorials/streaming-ui.md",
        label: "Streaming results into the UI",
      },
      {
        slug: "tutorials/booking-ranges",
        site: "tutorials/booking-ranges.md",
        label: "Availability with intervals",
      },
    ],
  },
  // starlight-typedoc's "API reference" group is appended here by astro.config.ts.
  {
    label: "Project",
    items: [
      {
        slug: "project/ecosystem",
        src: "README.md",
        sections: ["The xtandard ecosystem"],
        title: "The xtandard ecosystem",
        label: "xtandard ecosystem",
      },
      {
        slug: "project/recommended-libraries",
        site: "project/recommended-libraries.mdx",
        label: "Recommended libraries",
      },
      {
        slug: "project/recommending",
        src: "docs/RECOMMENDING.md",
        label: "Adding a recommendation",
        internal: true,
      },
      { slug: "project/changelog", src: "CHANGELOG.md", label: "Changelog" },
      { slug: "project/releasing", src: "docs/RELEASING.md", label: "Releasing", internal: true },
      { label: "npm", link: npmUrl },
    ],
  },
];

export const isPage = (i: Item): i is Page => "slug" in i;
export const isGroup = (i: Item): i is Group => "items" in i;

/** Every page, the home page first. */
export function pages(): Page[] {
  const out: Page[] = [home];
  const walk = (items: Item[]) => {
    for (const i of items) {
      if (isPage(i)) out.push(i);
      else if (isGroup(i)) walk(i.items);
    }
  };
  walk(sidebar);
  return out;
}
