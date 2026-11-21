// The shape of the recommended-libraries data (recs/libraries.ts), the categories it is grouped
// by, the status snapshot `bun run recs:check` writes (recs/status.json), and the policy that check
// applies (which licenses count as permissive, when a library counts as abandoned).
//
// Plain TypeScript, no runtime dependencies: the README generator, the check script and the docs
// site's React island all import it.

/** The categories, in the order the README and the site list them. */
export const categories = [
  {
    id: "utilities",
    label: "Language & data utilities",
    blurb: "Everyday helpers for objects, arrays, equality, cloning and stricter types.",
  },
  {
    id: "errors",
    label: "Errors & results",
    blurb: "Typed error handling beyond try/catch.",
  },
  {
    id: "async",
    label: "Async, concurrency & resilience",
    blurb: "Bounded concurrency, queues, retries and circuit breakers.",
  },
  {
    id: "caching",
    label: "Caching & storage",
    blurb: "Key-value storage, caches with stale-while-revalidate, file and blob storage.",
  },
  {
    id: "numbers",
    label: "Numbers, money & units",
    blurb: "Exact decimals and rationals, money, and byte sizes.",
  },
  {
    id: "dates",
    label: "Dates, time & scheduling",
    blurb: "Date math, the Temporal API, recurrence rules and cron.",
  },
  {
    id: "ids",
    label: "IDs & hashing",
    blurb: "Unique identifiers and hash functions.",
  },
  {
    id: "formats",
    label: "Parsing & formats",
    blurb: "Versions, IP addresses, JSON supersets, URL-friendly encodings and HTML.",
  },
  {
    id: "http",
    label: "HTTP clients & URLs",
    blurb: "fetch wrappers and URL helpers.",
  },
  {
    id: "server",
    label: "Servers & APIs",
    blurb: "Web frameworks, middleware and GraphQL.",
  },
  {
    id: "database",
    label: "Databases & ORMs",
    blurb: "Query builders, ORMs, embedded databases and their helpers.",
  },
  {
    id: "auth",
    label: "Auth & permissions",
    blurb: "Authentication and authorization.",
  },
  {
    id: "payments",
    label: "Payments",
    blurb: "Billing and payment APIs.",
  },
  {
    id: "jobs",
    label: "Background jobs & workflows",
    blurb: "Durable functions, queues and workflow engines.",
  },
  {
    id: "ai",
    label: "AI",
    blurb: "LLM toolkits, AI UI and sandboxes.",
  },
  {
    id: "messaging",
    label: "Email, chat & notifications",
    blurb: "Email templates, multi-channel notifications and chat bots.",
  },
  {
    id: "search",
    label: "Search",
    blurb: "Client-side and in-memory search.",
  },
  {
    id: "react-data",
    label: "React: state, data & routing",
    blurb: "Server state, client state, URL state, routing, forms and tables.",
  },
  {
    id: "react-ui",
    label: "React: UI components",
    blurb: "Headless and lightly styled components.",
  },
  {
    id: "styling",
    label: "Styling & animation",
    blurb: "Class names, variants, colors and motion.",
  },
  {
    id: "media",
    label: "Documents, media & devices",
    blurb: "Images, spreadsheets, barcodes, printers, uploads and haptics.",
  },
  {
    id: "tooling",
    label: "CLI, logging & tooling",
    blurb: "Command-line apps, processes, logging, environment and code health.",
  },
] as const satisfies readonly { id: string; label: string; blurb: string }[];

export type CategoryId = (typeof categories)[number]["id"];

/** How a recommendation relates to an xtandard entry point. */
export interface Pairing {
  /** The entry point, e.g. `@xtandard/lib/unstorage` (checked against package.json exports). */
  module: string;
  /** One or two sentences: what they do together, or when to pick which. */
  how: string;
  /** A short TypeScript example. Keep it to real APIs of both sides. */
  example?: string;
}

export interface Recommendation {
  /** Display name, usually the npm package name. */
  name: string;
  /** The npm package `recs:check` tracks (license, latest release, deprecation). */
  npm: string;
  /** GitHub repository, `owner/name` (`recs:check` reads archived status and activity from it). */
  repo: string;
  /** Documentation site, when it is not the repository's README. */
  docs?: string;
  category: CategoryId;
  /** What it provides, in one sentence. */
  provides: string;
  /** Why we recommend it: what makes it good, and why over the alternatives. */
  why: string;
  /**
   * SPDX license expression as published on npm. `recs:check` fails when npm reports something
   * else, which is how a relicense is caught.
   */
  license: string;
  /** The xtandard entry points it complements. */
  pairsWith?: Pairing[];
  /** What it replaces (older or heavier libraries, hand-rolled code). */
  insteadOf?: string;
  /** Something a user should know before adopting it (pre-1.0, beta, service-backed…). */
  caveat?: string;
  /**
   * Feature-complete, so rare releases are expected: `recs:check` reports it as stable instead of
   * flagging it as abandoned. Say why.
   */
  stable?: string;
  /** A claim above that could not be verified from the project's own README or docs. */
  unverified?: string;
}

/** What `recs:check` last saw for one package (recs/status.json). */
export interface PackageStatus {
  /** Latest version on npm (the `latest` dist-tag). */
  version: string;
  /** When that version was published (ISO date, `YYYY-MM-DD`). */
  released: string;
  /** License npm reports for that version. */
  license: string;
  /** npm deprecation message of that version, if any. */
  deprecated?: string;
  /** The repository on GitHub (after redirects), when it could be read. */
  repo?: string;
  archived?: boolean;
  /** Last commit on the default branch (ISO date). */
  lastCommit?: string;
  stars?: number;
}

export interface StatusFile {
  /** When `recs:check` last ran (ISO date). */
  checkedAt: string;
  packages: Record<string, PackageStatus>;
}

// ---- policy ---------------------------------------------------------------------------------

/** Licenses that put no copyleft obligation on users. */
export const permissiveLicenses = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Unlicense",
  "BlueOak-1.0.0",
  "Zlib",
  "CC0-1.0",
]);

/** File- or library-level copyleft: usable as a dependency, but modified files stay open. */
export const weakCopyleftLicenses = new Set([
  "MPL-2.0",
  "LGPL-2.1",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "EPL-2.0",
]);

export type LicenseClass = "permissive" | "weak-copyleft" | "restrictive";

/**
 * Classifies an SPDX expression. `A AND B` is as strict as its strictest part; `A OR B` as
 * lenient as its most lenient part (you may pick it). Anything unknown is restrictive.
 */
export function classifyLicense(expression: string): LicenseClass {
  const rank: Record<LicenseClass, number> = { permissive: 0, "weak-copyleft": 1, restrictive: 2 };
  const byRank: LicenseClass[] = ["permissive", "weak-copyleft", "restrictive"];
  const one = (id: string): LicenseClass =>
    permissiveLicenses.has(id)
      ? "permissive"
      : weakCopyleftLicenses.has(id)
        ? "weak-copyleft"
        : "restrictive";
  const clean = expression.replace(/[()]/g, " ").trim();
  if (!clean) return "restrictive";
  const alternatives = clean.split(/\s+OR\s+/).map((alt) => {
    const parts = alt.split(/\s+AND\s+/).map((p) => one(p.trim()));
    return Math.max(...parts.map((p) => rank[p]));
  });
  return byRank[Math.min(...alternatives)]!;
}

/** No release for this long AND no commit for {@link abandonedCommitMonths}: abandoned. */
export const abandonedReleaseMonths = 24;
export const abandonedCommitMonths = 12;
/** No release for this long: worth a look (a warning, not a failure). */
export const quietReleaseMonths = 18;

/** Whole months between two ISO dates. */
export function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) -
    (b.getUTCDate() < a.getUTCDate() ? 1 : 0)
  );
}

export const npmUrl = (pkg: string) => `https://www.npmjs.com/package/${pkg}`;
export const repoUrl = (repo: string) => `https://github.com/${repo}`;
