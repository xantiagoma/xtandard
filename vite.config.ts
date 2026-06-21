import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["node_modules/**", "dist/**"],
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
          exclude: ["test/fetch-with-progress.test.ts"],
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
  fmt: {},
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
      "src/entry-pagination-kysely.ts",
      "src/entry-pagination-knex.ts",
      "src/entry-pagination-mongo.ts",
      "src/entry-pagination-prisma.ts",
      "src/entry-web.ts",
      "src/entry-ulid.ts",
      "src/entry-temporal.ts",
      "src/entry-dataloader.ts",
      "src/entry-unstorage.ts",
      "src/entry-valibot.ts",
      "src/entry-sonner.ts",
      "src/entry-react.ts",
    ],
    dts: true,
    format: ["esm", "cjs"],
    sourcemap: true,
  },
});
