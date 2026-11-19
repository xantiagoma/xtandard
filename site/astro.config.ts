// The documentation site: Astro Starlight over the repository's Markdown (scripts/sync.ts copies it
// into src/content/docs/ first), a TypeDoc API reference generated from src/ (starlight-typedoc),
// Mermaid diagrams, and React islands for the playgrounds. site/manifest.ts holds the information
// architecture. `bun run build` writes dist/ here; pages.yml publishes it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import { createStarlightTypeDocPlugin } from "starlight-typedoc";
import { apiOverviews } from "./scripts/api-overviews.ts";
import {
  isGroup,
  isPage,
  repoRoot,
  repoUrl,
  sidebar,
  siteBase,
  siteOrigin,
  type Item,
} from "./manifest.ts";

type SidebarItem =
  | { slug: string; label?: string }
  | { label: string; link: string }
  | { label: string; collapsed?: boolean; items: SidebarItem[] };

const toSidebar = (items: Item[]): SidebarItem[] =>
  items.map((i) => {
    if (isPage(i)) return i.label ? { slug: i.slug, label: i.label } : { slug: i.slug };
    if (isGroup(i)) return { label: i.label, collapsed: i.collapsed, items: toSidebar(i.items) };
    return { label: i.label, link: i.link };
  });

// The playgrounds import the library from its source, by the same specifiers users write:
// `@xtandard/lib/filters/knex` → src/entry-filters-knex.ts (the package.json exports map).
const exportsMap = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
  .exports as Record<string, unknown>;
// Every entry point, in package.json order: the import specifier and its source file.
const entries = Object.keys(exportsMap).map((key) => {
  const sub = key.replace(/^\.\/?/, "");
  const file = join(
    repoRoot,
    "src",
    sub === "" ? "index.ts" : `entry-${sub.replaceAll("/", "-")}.ts`,
  );
  if (!existsSync(file)) throw new Error(`astro.config.ts: no source entry for "${key}" (${file})`);
  return { find: sub === "" ? "@xtandard/lib" : `@xtandard/lib/${sub}`, replacement: file };
});
/** Entry points other entry points re-export from; the API reference documents those symbols here. */
const apiOwners = ["src/index.ts", "src/entry-pagination.ts", "src/entry-tanstack-server.ts"];
const libAliases = [...entries]
  // Longest first, so `@xtandard/lib` does not shadow `@xtandard/lib/filters`.
  .sort((a, b) => b.find.length - a.find.length)
  .map(({ find, replacement }) => ({
    find: new RegExp(`^${find.replaceAll("/", "\\/")}$`),
    replacement,
  }));

const [apiReference, apiSidebarGroup] = createStarlightTypeDocPlugin();

export default defineConfig({
  site: siteOrigin,
  base: siteBase,
  trailingSlash: "ignore",
  telemetry: false,
  vite: {
    resolve: { alias: libAliases, dedupe: ["react", "react-dom"] },
  },
  integrations: [
    // Must come before Starlight.
    mermaid({ theme: "neutral", autoTheme: true, enableLog: false }),
    react(),
    starlight({
      title: "@xtandard/lib",
      description: "Lightweight, type-safe TypeScript utilities — zero dependencies for the core.",
      logo: { src: "../assets/logo.png", alt: "xtandard" },
      favicon: "/favicon.png",
      social: [
        { icon: "github", label: "GitHub", href: repoUrl },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/@xtandard/lib" },
      ],
      editLink: { baseUrl: `${repoUrl}/edit/main/` },
      lastUpdated: false,
      customCss: ["./src/styles/brand.css"],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        ...toSidebar(sidebar).slice(0, -1),
        apiSidebarGroup,
        ...toSidebar(sidebar).slice(-1),
      ],
      plugins: [
        apiReference({
          // A fixed order: a symbol exported by several entry points is documented under the first
          // one TypeDoc meets, and a glob's order differs between file systems (macOS vs the Linux
          // CI). The modules that others re-export from come first, so /filters does not claim
          // createPaginator and /tanstack does not claim the /tanstack/server parsers; then the rest
          // alphabetically.
          entryPoints: [
            ...apiOwners.map((f) => join(repoRoot, f)),
            ...entries
              .map((e) => e.replacement)
              .filter((f) => !apiOwners.some((o) => f.endsWith(o)))
              .sort(),
          ],
          tsconfig: "../tsconfig.json",
          output: "api",
          sidebar: { label: "API reference", collapsed: true },
          typeDoc: {
            plugin: ["typedoc-plugin-missing-exports"],
            // @ts-expect-error -- typedoc-plugin-missing-exports options
            placeInternalsInOwningModule: true,
            excludePrivate: true,
            excludeInternal: true,
            excludeExternals: true,
            disableGit: true,
            // tsc (`bun run check`, CI) type-checks the project, tests included. TypeDoc only reads
            // src/, and its own check of the whole program fails on test-only imports such as
            // node:sqlite.
            skipErrorChecking: true,
            // {path} is relative to src/ (the entry points' common directory).
            sourceLinkTemplate: `${repoUrl}/blob/main/src/{path}#L{line}`,
            useCodeBlocks: true,
            parametersFormat: "table",
            interfacePropertiesFormat: "table",
            classPropertiesFormat: "table",
            typeDeclarationFormat: "table",
            enumMembersFormat: "table",
          },
        }),
        // After starlight-typedoc (plugins run in order): the /api/ and /api/<module>/ pages.
        apiOverviews(),
        starlightLinksValidator({
          errorOnRelativeLinks: false,
          errorOnInvalidHashes: true,
        }),
      ],
    }),
  ],
});
