/**
 * Post-build guard (`bun run build` runs it after `check-dist.ts`): type-checks the published
 * `.d.mts`/`.d.cts` the way a consumer on `moduleResolution: "nodenext"` sees them. A temp project
 * links this package as `node_modules/@xtandard/lib` and imports every `exports` subpath from an
 * ESM (`.mts`) and a CJS (`.cts`) file, compiled with `skipLibCheck: false`. Fails on any error in
 * our `dist/` or in the consumer files; errors inside third-party peers' own `.d.ts` are not ours
 * and are only counted.
 *
 * The `…/effect/v4` subpaths import the `effect` peer, but this repo's `effect` devDep is effect 3
 * (effect 4 is the `effect-v4` alias), so they are checked in a second program whose `paths` point
 * `effect` at the alias, as a consumer on effect 4 would resolve it.
 */
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const dist = join(root, "dist") + "/";
const tsc = join(root, "node_modules/.bin/tsc");
const effectV4 = join(root, "node_modules/effect-v4/dist");

const pkg = await Bun.file(join(root, "package.json")).json();
const subpaths = Object.keys(pkg.exports as Record<string, unknown>)
  .filter((key) => key !== "./package.json")
  .map((key) => `${pkg.name}${key.slice(1)}`);
const isEffectV4 = (spec: string) => /\/effect\/v4$/.test(spec);

const programs = [
  { name: "default", subpaths: subpaths.filter((s) => !isEffectV4(s)), paths: undefined },
  {
    name: "effect 4",
    subpaths: subpaths.filter(isEffectV4),
    paths: { effect: [join(effectV4, "index.d.ts")], "effect/*": [join(effectV4, "*.d.ts")] },
  },
];

const dir = await mkdtemp(join(tmpdir(), "xtandard-dist-types-"));
try {
  await mkdir(join(dir, "node_modules/@xtandard"), { recursive: true });
  await symlink(root, join(dir, "node_modules/@xtandard/lib"), "dir");

  let ignored = 0;
  const ours: string[] = [];
  for (const program of programs) {
    const source = program.subpaths
      .map((spec, i) => `import * as m${i} from "${spec}";\nexport { m${i} };\n`)
      .join("");
    const base = program.name.replace(/\W+/g, "-");
    await Bun.write(join(dir, `${base}.mts`), source);
    await Bun.write(join(dir, `${base}.cts`), source);
    const tsconfig = `tsconfig.${base}.json`;
    await Bun.write(
      join(dir, tsconfig),
      JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          lib: ["ESNext", "DOM", "DOM.Iterable"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: ["node"],
          typeRoots: [join(root, "node_modules/@types")],
          ...(program.paths ? { paths: program.paths } : {}),
        },
        files: [`${base}.mts`, `${base}.cts`],
      }),
    );

    const proc = Bun.spawnSync([tsc, "-p", join(dir, tsconfig), "--pretty", "false"], { cwd: dir });
    const output = proc.stdout.toString() + proc.stderr.toString();
    const errors = output.split("\n").filter((line) => /error TS\d+/.test(line));
    if (errors.length === 0 && proc.exitCode !== 0) {
      ours.push(`(${program.name}) tsc failed without diagnostics:\n${output}`);
    }
    // `path(line,col): error TS…`, with paths relative to `dir`.
    for (const line of errors) {
      const file = resolve(dir, line.slice(0, line.indexOf("(")));
      if (file.startsWith(dist) || file.startsWith(dir)) ours.push(line);
      else ignored++;
    }
  }

  if (ours.length > 0) {
    console.error(
      `check-dist-types: ${ours.length} type error(s) in dist/ for a nodenext consumer:\n  ${ours.join("\n  ")}`,
    );
    // Not process.exit(): let `finally` remove the temp project.
    process.exitCode = 1;
  } else {
    console.log(
      `check-dist-types: ${subpaths.length} subpaths OK under nodenext (ESM + CJS)` +
        (ignored > 0 ? `; ${ignored} error(s) inside third-party peer types ignored` : ""),
    );
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
