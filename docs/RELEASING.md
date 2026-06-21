# Releasing

This package publishes from GitHub Actions when a `v*` tag is pushed.

## Versioning Policy

This package intends to stay on `0.x` **indefinitely** — there is no planned
`1.0.0` ("ZeroVer"). Staying pre-1.0 keeps iteration cheap and avoids the
implicit "frozen forever" contract a `1.0.0` signals. A `1.0.0` is only on the
table if the API surface genuinely stabilizes for a broad external audience.

We follow **standard semver** within `0.x` to choose the bump direction (this
matches changelogen's conventional-commit inference). The resulting version is
still passed explicitly via `-r <version>` at release time — see
[Pre-1.0 Versions](#important-pre-10-versions) for why.

| Change                           | Bump             | Example         | Conventional commit                            |
| -------------------------------- | ---------------- | --------------- | ---------------------------------------------- |
| New feature, backward compatible | **minor**        | `0.4.0 → 0.5.0` | `feat:`                                        |
| Bug fix, backward compatible     | **patch**        | `0.4.0 → 0.4.1` | `fix:`                                         |
| Breaking change                  | **minor** + flag | `0.4.0 → 0.5.0` | `feat!:` / `fix!:` / `BREAKING CHANGE:` footer |

Always **flag breaking changes** with a `!` (`feat!:`) or a `BREAKING CHANGE:`
commit footer. changelogen renders them under a `⚠️ Breaking Changes` heading in
the CHANGELOG and they surface in the GitHub release notes — that is how
consumers are warned.

Caveat (accepted): because a breaking change lands as a `0.x` **minor**, a
`^0.x` range will still upgrade across it (the classic `^0.x` footgun). The
primary consumers here pin exact versions (e.g. catalog versioning), so this is
acceptable; anyone wanting hard protection should pin `~0.x`. If the package
ever gains many external `^`-pinning consumers, switch to the caret-protective
"0ver" convention (breaking → minor, everything else → patch) at that point.

> Note: the `⚠️` heading changelogen emits can have a double space after the
> emoji that oxfmt rewrites — after a breaking release run `bun run format` and
> commit the CHANGELOG fix so `format:check` stays green (the publish workflow is
> unaffected, but the `main` CI runs `format:check`).

## CI/CD Overview

### CI

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`:

- `bun install`
- `bunx playwright install --with-deps chromium`
- `bun run lint`
- `bun run format:check`
- `npx tsc --noEmit`
- `bun run test`
- `bun run build`

### Publish

`.github/workflows/publish.yml` runs on pushed tags matching `v*`:

- `bun install`
- `bunx playwright install --with-deps chromium`
- `bun run test`
- `bun run build`
- `npm publish --provenance --access public || npm publish --access public`
- `gh release create <tag> --generate-notes || echo "Release already exists"`

The publish workflow requires `NPM_TOKEN` in repository secrets. GitHub release
creation uses the workflow `GITHUB_TOKEN`.

## Normal Release Flow

1. Ensure all feature/fix changes are already committed.
2. Run local validation:

```bash
bun run format
bun run check
bun run test
bun run build
npm pack --dry-run
```

3. Create the release commit and tag with an explicit version:

```bash
bunx changelogen --release -r 0.2.0 --push --no-open
```

Replace `0.2.0` with the intended version.

4. Watch GitHub Actions:

```bash
gh run list --limit 5
gh run watch <run-id>
```

5. Confirm npm and GitHub release state:

```bash
npm view xantiagoma version
gh release list --limit 5
```

## Important: Pre-1.0 Versions

Do **not** use `--minor` to create a `0.x` minor release. Changelogen follows
pre-1.0 semver behavior and may convert a minor bump such as `0.2.0` into the
next patch, e.g. `0.1.3`.

Use an explicit version instead:

```bash
bunx changelogen --release -r 0.2.0 --push --no-open
```

The package script `bun run release` uses automatic bump detection. Use it only
when the inferred version is acceptable. For planned minor releases, prefer the
explicit `-r <version>` command above.

## If The Wrong Tag Is Pushed

If a wrong tag is pushed but npm has **not** published it yet:

```bash
gh run list --workflow Publish --limit 5
gh run cancel <publish-run-id>
git tag -d v0.1.3
git push origin :refs/tags/v0.1.3
```

Then create the intended release with an explicit version.

If npm has already published the wrong version, do not delete or rewrite it.
Publish a new corrected version instead.

## Package Contents

`package.json` controls published files. Keep `docs` in the `files` list because
the README links to `docs/PAGINATION.md` and `docs/sync-async-adaptive.md`.

Before publishing, verify package contents:

```bash
npm pack --dry-run --json
```
