/**
 * Post-build guard (`bun run build` runs it after `vp pack`): the effect 4 sources import the
 * `effect-v4` dev alias (npm:effect@^4), which the pack config keeps external and remaps to the
 * `effect` peer. Fails when any published file still imports `effect-v4` or inlines effect's own
 * files (a `//#region node_modules/effect…` chunk), which would break `@xtandard/lib/effect/v4` and
 * `@xtandard/lib/filters/effect/v4` for users. Source maps are skipped: their `sourcesContent`
 * embeds the original `from "effect-v4"` imports on purpose.
 */
import { Glob } from "bun";

const dist = new URL("../dist/", import.meta.url).pathname;

const ALIAS_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']effect-v4(?:\/[^"']*)?["']/;
const INLINED_EFFECT = /^\/\/#region node_modules\/effect/m;

const problems: string[] = [];
let checked = 0;
for await (const file of new Glob("**/*.{mjs,cjs,d.mts,d.cts}").scan(dist)) {
  const code = await Bun.file(dist + file).text();
  checked++;
  if (ALIAS_IMPORT.test(code)) problems.push(`${file}: imports the "effect-v4" dev alias`);
  if (INLINED_EFFECT.test(code)) problems.push(`${file}: inlines effect from node_modules`);
}

if (checked === 0) {
  console.error(`check-dist: no build output in ${dist}; run \`vp pack\` first`);
  process.exit(1);
}
if (problems.length > 0) {
  console.error(`check-dist: ${problems.length} problem(s) in dist/:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-dist: ${checked} files OK (no "effect-v4" imports, no inlined effect)`);
