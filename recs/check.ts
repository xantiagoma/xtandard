// `bun run recs:check`: re-checks every recommended library against the npm registry and GitHub,
// writes what it saw to recs/status.json (the docs site shows the license and latest release from
// it), and reports anything that needs a human:
//
//   error  deprecated on npm, archived or missing on GitHub, a non-permissive license, a license
//          that no longer matches recs/libraries.ts (relicensed), or abandoned: no release for
//          `abandonedReleaseMonths` and no commit for `abandonedCommitMonths`
//   warn   no release for `quietReleaseMonths`, a weak-copyleft license, a moved repository
//   info   a quiet library marked `stable` (feature-complete), so its silence is expected
//
// Exits 1 when there is an error. It never edits recs/libraries.ts: removals are a maintainer's
// call (see docs/RECOMMENDING.md).
//
// GitHub: uses GITHUB_TOKEN / GH_TOKEN, else `gh auth token`, else unauthenticated REST (60
// requests an hour; the check stops querying GitHub when the limit is hit and says so).
//
//   bun run recs:check              # check, print the report, write recs/status.json
//   bun run recs:check --no-write   # check and print only
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { libraries } from "./libraries.ts";
import {
  abandonedCommitMonths,
  abandonedReleaseMonths,
  classifyLicense,
  monthsBetween,
  quietReleaseMonths,
  type PackageStatus,
  type Recommendation,
  type StatusFile,
} from "./schema.ts";

const statusPath = fileURLToPath(new URL("./status.json", import.meta.url));
const write = !process.argv.includes("--no-write");
const today = new Date().toISOString().slice(0, 10);

// ---- HTTP with retries ----------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with up to 4 attempts on network errors, 429 and 5xx, honoring `Retry-After`. */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const after = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 500 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (error) {
      if (attempt >= 4) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

// ---- npm ------------------------------------------------------------------------------------

type NpmResult =
  | { ok: true; version: string; released: string; license: string; deprecated?: string }
  | { ok: false; reason: string };

function licenseOf(manifest: { license?: unknown; licenses?: unknown }): string {
  const l = manifest.license ?? manifest.licenses;
  if (typeof l === "string") return l;
  if (Array.isArray(l)) return l.map((x) => (x as { type?: string }).type ?? "?").join(" OR ");
  if (l && typeof l === "object" && "type" in l) return String((l as { type: unknown }).type);
  return "";
}

async function npmInfo(pkg: string): Promise<NpmResult> {
  const res = await request(`https://registry.npmjs.org/${pkg.replace("/", "%2F")}`, {
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return { ok: false, reason: "not found on npm" };
  if (!res.ok) return { ok: false, reason: `npm registry answered ${res.status}` };
  const doc = (await res.json()) as {
    "dist-tags"?: { latest?: string };
    time?: Record<string, string>;
    versions?: Record<string, { license?: unknown; licenses?: unknown; deprecated?: string }>;
  };
  const version = doc["dist-tags"]?.latest;
  const manifest = version ? doc.versions?.[version] : undefined;
  if (!version || !manifest) return { ok: false, reason: "no published version (unpublished?)" };
  return {
    ok: true,
    version,
    released: (doc.time?.[version] ?? "").slice(0, 10),
    license: licenseOf(manifest),
    deprecated: manifest.deprecated || undefined,
  };
}

// ---- GitHub ---------------------------------------------------------------------------------

type RepoResult =
  | { ok: true; repo: string; archived: boolean; lastCommit?: string; stars: number }
  | { ok: false; reason: string };

function githubToken(): string | undefined {
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (env) return env;
  try {
    return (
      execFileSync("gh", ["auth", "token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

/** One GraphQL query per 40 repositories. */
async function githubGraphql(repos: string[], token: string): Promise<Map<string, RepoResult>> {
  const out = new Map<string, RepoResult>();
  const fields =
    "nameWithOwner isArchived stargazerCount defaultBranchRef { target { ... on Commit { committedDate } } }";
  for (let i = 0; i < repos.length; i += 40) {
    const chunk = repos.slice(i, i + 40);
    const query = `query { ${chunk
      .map((r, j) => {
        const [owner, name] = r.split("/");
        return `r${j}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${fields} }`;
      })
      .join("\n")} }`;
    const res = await request("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const reason =
        res.headers.get("x-ratelimit-remaining") === "0"
          ? "GitHub rate limit reached"
          : `GitHub answered ${res.status}`;
      for (const r of repos.slice(i)) out.set(r, { ok: false, reason });
      break;
    }
    const body = (await res.json()) as {
      data?: Record<
        string,
        {
          nameWithOwner: string;
          isArchived: boolean;
          stargazerCount: number;
          defaultBranchRef?: { target?: { committedDate?: string } };
        } | null
      >;
      errors?: { type?: string; message: string }[];
    };
    if (body.errors?.some((e) => e.type === "RATE_LIMITED")) {
      for (const r of repos.slice(i))
        out.set(r, { ok: false, reason: "GitHub rate limit reached" });
      break;
    }
    chunk.forEach((r, j) => {
      const d = body.data?.[`r${j}`];
      out.set(
        r,
        d
          ? {
              ok: true,
              repo: d.nameWithOwner,
              archived: d.isArchived,
              lastCommit: d.defaultBranchRef?.target?.committedDate?.slice(0, 10),
              stars: d.stargazerCount,
            }
          : { ok: false, reason: "repository not found on GitHub" },
      );
    });
  }
  return out;
}

/** Unauthenticated fallback: one REST call per repository; `pushed_at` stands in for the last commit. */
async function githubRest(repos: string[]): Promise<Map<string, RepoResult>> {
  const out = new Map<string, RepoResult>();
  let limited = false;
  for (const r of repos) {
    if (limited) {
      out.set(r, { ok: false, reason: "GitHub rate limit reached (set GITHUB_TOKEN)" });
      continue;
    }
    const res = await request(`https://api.github.com/repos/${r}`, {
      headers: { accept: "application/vnd.github+json" },
    });
    if (
      (res.status === 403 || res.status === 429) &&
      res.headers.get("x-ratelimit-remaining") === "0"
    ) {
      limited = true;
      out.set(r, { ok: false, reason: "GitHub rate limit reached (set GITHUB_TOKEN)" });
      continue;
    }
    if (res.status === 404) {
      out.set(r, { ok: false, reason: "repository not found on GitHub" });
      continue;
    }
    if (!res.ok) {
      out.set(r, { ok: false, reason: `GitHub answered ${res.status}` });
      continue;
    }
    const d = (await res.json()) as {
      full_name: string;
      archived: boolean;
      pushed_at?: string;
      stargazers_count: number;
    };
    out.set(r, {
      ok: true,
      repo: d.full_name,
      archived: d.archived,
      lastCommit: d.pushed_at?.slice(0, 10),
      stars: d.stargazers_count,
    });
  }
  return out;
}

// ---- policy ---------------------------------------------------------------------------------

type Level = "error" | "warn" | "info";
type Finding = { level: Level; lib: Recommendation; message: string };

function assess(
  lib: Recommendation,
  npm: NpmResult,
  gh: RepoResult | undefined,
): { findings: Finding[]; status?: PackageStatus } {
  const findings: Finding[] = [];
  const add = (level: Level, message: string) => findings.push({ level, lib, message });

  if (!npm.ok) {
    add("error", `${lib.npm}: ${npm.reason}`);
    return { findings };
  }
  if (npm.deprecated) add("error", `deprecated on npm: "${npm.deprecated}"`);
  if (!npm.license) add("error", "npm reports no license");
  else {
    const cls = classifyLicense(npm.license);
    if (cls === "restrictive") add("error", `non-permissive license on npm: ${npm.license}`);
    else if (cls === "weak-copyleft") add("warn", `weak-copyleft license: ${npm.license}`);
    if (npm.license !== lib.license)
      add(
        "error",
        `license changed: recs/libraries.ts says ${lib.license}, npm says ${npm.license}`,
      );
  }

  if (gh && !gh.ok) add(gh.reason.includes("rate limit") ? "warn" : "error", gh.reason);
  if (gh?.ok) {
    if (gh.archived) add("error", `GitHub repository ${gh.repo} is archived`);
    if (gh.repo.toLowerCase() !== lib.repo.toLowerCase())
      add("warn", `repository moved: ${lib.repo} → ${gh.repo} (update \`repo\`)`);
  }

  const sinceRelease = npm.released ? monthsBetween(npm.released, today) : 0;
  const sinceCommit = gh?.ok && gh.lastCommit ? monthsBetween(gh.lastCommit, today) : undefined;
  const abandoned =
    sinceRelease >= abandonedReleaseMonths &&
    (sinceCommit === undefined || sinceCommit >= abandonedCommitMonths);
  const quiet = sinceRelease >= quietReleaseMonths;
  const activity = `last release ${npm.released} (${sinceRelease} months)${
    sinceCommit === undefined
      ? ""
      : `, last commit ${gh?.ok ? gh.lastCommit : "?"} (${sinceCommit} months)`
  }`;
  if ((abandoned || quiet) && lib.stable) add("info", `quiet but marked stable: ${activity}`);
  else if (abandoned) add("error", `looks abandoned: ${activity}`);
  else if (quiet) add("warn", `no release for ${quietReleaseMonths}+ months: ${activity}`);

  return {
    findings,
    status: {
      version: npm.version,
      released: npm.released,
      license: npm.license,
      ...(npm.deprecated ? { deprecated: npm.deprecated } : {}),
      ...(gh?.ok
        ? {
            repo: gh.repo,
            archived: gh.archived,
            ...(gh.lastCommit ? { lastCommit: gh.lastCommit } : {}),
            stars: gh.stars,
          }
        : {}),
    },
  };
}

// ---- run ------------------------------------------------------------------------------------

const npmResults = new Map<string, NpmResult>();
await pool(libraries, 8, async (lib) => {
  try {
    npmResults.set(lib.npm, await npmInfo(lib.npm));
  } catch (error) {
    npmResults.set(lib.npm, { ok: false, reason: `npm request failed: ${String(error)}` });
  }
});

const repos = [...new Set(libraries.map((l) => l.repo))];
const token = githubToken();
let ghResults: Map<string, RepoResult>;
try {
  ghResults = token ? await githubGraphql(repos, token) : await githubRest(repos);
} catch (error) {
  console.warn(`recs:check: GitHub checks skipped (${String(error)})`);
  ghResults = new Map();
}
if (!token)
  console.warn("recs:check: no GitHub token; using unauthenticated REST (60 requests/hour)");

const findings: Finding[] = [];
const previous: StatusFile | undefined = (() => {
  try {
    return JSON.parse(readFileSync(statusPath, "utf8")) as StatusFile;
  } catch {
    return undefined;
  }
})();
const packages: Record<string, PackageStatus> = {};
for (const lib of libraries) {
  const result = assess(lib, npmResults.get(lib.npm)!, ghResults.get(lib.repo));
  findings.push(...result.findings);
  // Keep the last good snapshot of a package this run could not read.
  const status = result.status ?? previous?.packages[lib.npm];
  if (status) packages[lib.npm] = status;
}

const order: Level[] = ["error", "warn", "info"];
const icon: Record<Level, string> = { error: "✖", warn: "▲", info: "·" };
for (const level of order) {
  const these = findings.filter((f) => f.level === level);
  if (!these.length) continue;
  console.log(`\n${level.toUpperCase()} (${these.length})`);
  for (const f of these) console.log(`  ${icon[level]} ${f.lib.name} (${f.lib.npm}): ${f.message}`);
}
const count = (l: Level) => findings.filter((f) => f.level === l).length;
console.log(
  `\nrecs:check: ${libraries.length} libraries, ${count("error")} error(s), ${count("warn")} warning(s), ${count("info")} note(s)`,
);

if (write) {
  const sorted = Object.fromEntries(
    Object.entries(packages).sort(([a], [b]) => a.localeCompare(b)),
  );
  const file: StatusFile = { checkedAt: today, packages: sorted };
  writeFileSync(statusPath, `${JSON.stringify(file, null, 2)}\n`);
  console.log("recs:check: wrote recs/status.json (run `bun run recs:generate` next)");
}
if (count("error") > 0) process.exitCode = 1;
