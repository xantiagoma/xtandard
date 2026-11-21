# How to add a recommendation

xtandard's rule: if a well-maintained, permissively licensed library already does something well,
we recommend it instead of rebuilding it. The list lives in
[`recs/libraries.ts`](../recs/libraries.ts); the README section and the
[docs site page](https://me.xantiagoma.com/xtandard/project/recommended-libraries/) are generated
from it.

## Criteria

A library goes on the list when all of these hold:

- **Permissive license.** MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD and similar. A weak-copyleft
  license (MPL-2.0, LGPL) is accepted only with a `caveat` that says what it means for users.
  GPL, AGPL, SSPL, BUSL and "source-available" licenses are not.
- **Maintained.** A release in the last 18 months, or a library that is feature-complete and says
  so (mark it `stable` with the reason). Archived or deprecated packages don't qualify.
- **Best in its niche.** You can say why it beats the alternatives (`why`) and what it replaces
  (`insteadOf`). Two libraries for the same job need a reason to keep both (for example big.js
  vs decimal.js: size vs features).
- **Verified.** Every claim comes from the project's own README or docs. If you can't verify one,
  say so in `unverified` instead of guessing.

## Steps

1. Add an entry to `recs/libraries.ts` in its category (the types in
   [`recs/schema.ts`](../recs/schema.ts) document every field):

   ```ts
   {
     name: "p-queue",
     npm: "p-queue",
     repo: "sindresorhus/p-queue",
     category: "async",
     provides: "A promise queue with concurrency control, priorities and interval-based rate limiting.",
     why: "Zero dependencies and battle-tested. …",
     license: "MIT",
     pairsWith: [{ module: "@xtandard/lib", how: "…", example: `…` }],
   },
   ```

   `pairsWith` is the most useful field: which xtandard entry point the library complements, and
   when to pick which. Keep examples short and run them before committing.

2. Check it against npm and GitHub, and refresh the snapshot the site shows:

   ```sh
   bun run recs:check
   ```

   It writes `recs/status.json` and fails on a deprecated, archived, abandoned or
   non-permissively licensed package, or a license that differs from the entry's `license`.

3. Regenerate the README section and commit everything:

   ```sh
   bun run recs:generate
   ```

   `bun run check` (and CI) fail when the README is out of date with `recs/libraries.ts`.

## Keeping the list healthy

Run `bun run recs:check` from time to time (before a release is a good moment). What it reports:

| Level | Meaning                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| error | Deprecated on npm, archived or missing on GitHub, non-permissive license, license changed, or abandoned (no release for 24 months and no commit for 12)  |
| warn  | No release for 18 months, a weak-copyleft license, the repository moved, or npm's `latest` is a prerelease of a new major (e.g. `2.0.0-beta.0` over 1.x) |
| info  | A quiet library marked `stable`                                                                                                                          |

It also checks this package's own `peerDependencies` and warns when npm's `latest` is above a
peer range: a prerelease of a new major to track, or a new stable major to test and widen the
range for (see [Releasing](./RELEASING.md#peer-dependencies)).

The check never edits the list. A package that needs replacing or removing gets a `caveat` saying
so, and a maintainer decides in a pull request.
