import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["node_modules/**", "dist/**"],
    // @effective/rison's published `main` (dist/rison.js) uses extensionless
    // relative imports (invalid ESM); inline it so Vite/esbuild bundles + resolves
    // them. Real consumers go through a bundler that handles this transparently.
    server: { deps: { inline: ["@effective/rison"] } },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.test.tsx"],
          environment: "node",
          setupFiles: ["./test/setup-msw.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["test/**/*.test.tsx"],
          // `extends: true` inherits the root include, so the plain .test.ts suites run here too;
          // these need Node built-ins (node:sqlite, node:http) and run only in the node project.
          exclude: [
            "test/fetch-with-progress.test.ts",
            "test/filters-adapters.test.ts",
            "test/filters-agreement.test.ts",
            "test/filters-build-where.test.ts",
            "test/filters-drizzle-rqb.test.ts",
            "test/filters-sql-tag.test.ts",
            "test/filters-postgrest.test.ts",
            "test/filters-search-live.test.ts",
            "test/intercept-http.test.ts",
            "test/pagination-sql-tag.test.ts",
          ],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  lint: {},
  fmt: {
    // oxfmt formats .mdx as plain Markdown and mangles MDX syntax ({/* comments */} → {/_ … _/}).
    ignorePatterns: ["site/**/*.mdx"],
  },
  staged: {
    "*.{ts,tsx}": ["vp fmt", "vp lint"],
  },
  pack: {
    entry: [
      "src/index.ts",
      "src/entry-interval.ts",
      "src/entry-dinero.ts",
      "src/entry-decimal.ts",
      "src/entry-big.ts",
      "src/entry-bignumber.ts",
      "src/entry-fraction.ts",
      "src/entry-semver.ts",
      "src/entry-ip.ts",
      "src/entry-pagination.ts",
      "src/entry-pagination-drizzle.ts",
      "src/entry-pagination-drizzle-rqb.ts",
      "src/entry-pagination-kysely.ts",
      "src/entry-pagination-knex.ts",
      "src/entry-pagination-sql-tag.ts",
      "src/entry-pagination-mongo.ts",
      "src/entry-pagination-prisma.ts",
      "src/entry-web.ts",
      "src/entry-tanstack.ts",
      "src/entry-tanstack-server.ts",
      "src/entry-tanstack-testing.ts",
      "src/entry-tanstack-temporal.ts",
      "src/entry-tanstack-rison.ts",
      "src/entry-filters.ts",
      "src/entry-filters-valibot.ts",
      "src/entry-filters-zod.ts",
      "src/entry-filters-arktype.ts",
      "src/entry-filters-effect.ts",
      "src/entry-filters-drizzle.ts",
      "src/entry-filters-drizzle-rqb.ts",
      "src/entry-filters-kysely.ts",
      "src/entry-filters-knex.ts",
      "src/entry-filters-sql-tag.ts",
      "src/entry-filters-mongo.ts",
      "src/entry-filters-prisma.ts",
      "src/entry-filters-memory.ts",
      "src/entry-filters-tanstack-table.ts",
      "src/entry-filters-postgrest.ts",
      "src/entry-filters-elasticsearch.ts",
      "src/entry-ulid.ts",
      "src/entry-temporal.ts",
      "src/entry-dataloader.ts",
      "src/entry-unstorage.ts",
      "src/entry-valibot.ts",
      "src/entry-zod.ts",
      "src/entry-arktype.ts",
      "src/entry-effect.ts",
      "src/entry-sonner.ts",
      "src/entry-react.ts",
    ],
    dts: true,
    format: ["esm", "cjs"],
    sourcemap: true,
  },
});
