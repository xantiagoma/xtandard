import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  lint: {},
  fmt: {},
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm", "cjs"],
    sourcemap: true,
  },
});
