# Integrating `feedbackland-react` into the `feedbackland` monorepo

**Date:** 2026-04-25
**Author:** David Cnoops (with Claude)
**Status:** Approved design — ready for implementation plan

## Context

`feedbackland-react` is a React widget library (`FeedbackButton`, internal `OverlayWidget` / `PopoverWidget`) currently developed in a standalone GitHub repo at `github.com/feedbackland/feedbackland-react` and published to npm as `feedbackland-react` (currently `2.7.3`). The Next.js application at `github.com/feedbackland/feedbackland` consumes it via the npm registry (`"feedbackland-react": "^2.7.2"` in `package.json`).

The user copied the inner repo as a subfolder (`feedbackland/feedbackland-react/`), giving us two nested git repos. Goal: collapse to a single repo, manageable as one project, while preserving the ability to publish new versions of `feedbackland-react` to npm.

## Decisions locked during brainstorming

1. **Single repo going forward.** The standalone `github.com/feedbackland/feedbackland-react` repo will be archived (not deleted) post-migration. `github.com/feedbackland/feedbackland` becomes the single source of truth. The npm package name (`feedbackland-react`) is unchanged.
2. **No git history preservation.** Clean drop-in: delete the inner `.git/` and add files as fresh content in the outer repo. The archived standalone repo keeps the historical commits as a read-only reference.
3. **Local-first via npm workspaces.** When the Next.js app `import`s `feedbackland-react`, it resolves to the local package via a `node_modules` symlink. Editing a widget reflects in the app on rebuild. `npm publish` from the workspace continues to ship to the registry for external consumers.
4. **Flat layout.** Both projects stay at their current paths. Next.js app at the repo root; library at `feedbackland-react/`. No file moves to `apps/` or `packages/`. (Approach 1 from the brainstorm.)
5. **No build orchestrator** (no Turborepo / Nx). A single `npm run build` script chains library build then `next build`. Library's existing `prepare` script auto-builds on `npm install`.

## Final repository topology

```
feedbackland/                          # outer git repo (only one .git)
├── .git/                              # outer's history (kept)
├── .gitignore                         # updated (Section 5 below)
├── .npmrc                             # outer's existing file (force=true)
├── package.json                       # workspace root + Next.js app
├── package-lock.json                  # SINGLE lockfile, hoisted
├── node_modules/                      # SINGLE node_modules, hoisted
├── next.config.ts, tsconfig.json, eslint.config.mjs, ...
├── app/, components/, hooks/, lib/, ...                 (Next.js app, unchanged)
├── public/, db/, supabase/, queries/, trpc/, providers/, docs/
└── feedbackland-react/                # workspace package
    ├── package.json                   # library, mostly unchanged
    ├── src/                           # library source, unchanged
    ├── dist/                          # build output (gitignored, regenerated)
    ├── vite.config.ts, tsconfig*.json, eslint.config.js, components.json
    ├── README.md, LICENSE
    └── (no .git, no node_modules, no package-lock.json, no .npmrc)
```

**Removed from `feedbackland-react/`** during migration:

- `.git/` — the inner git repo
- `.npmrc` — leaked npm publish token (rotated; see Token security below)
- `node_modules/` — replaced by hoisted root `node_modules/`
- `package-lock.json` — replaced by root's lockfile
- `dist/` — rebuilt fresh by `npm install` via the workspace's `prepare` script

**Kept (unchanged) in `feedbackland-react/`**: `src/`, `package.json`, `vite.config.ts`, all tsconfigs, `eslint.config.js`, `components.json`, `README.md`, `LICENSE`, `index.html`.

**Kept (unchanged) at the root**: every file/folder of the Next.js app. No imports break, no path aliases change, `next.config.ts` is unchanged.

## `package.json` edits

### Root `package.json`

Two edits only:

1. **Add a `workspaces` field:**
   ```jsonc
   "workspaces": ["feedbackland-react"]
   ```
2. **Remove the registry dependency** by deleting the `"feedbackland-react": "^2.7.2"` entry from `dependencies`. The workspace declaration replaces it with a symlink at `node_modules/feedbackland-react → ../feedbackland-react`.
3. **Modify the `build` script** so production builds always rebuild the library first:
   ```jsonc
   "build": "npm run build -w feedbackland-react && next build"
   ```
4. **Optional convenience script** for releasing the library:
   ```jsonc
   "release:react": "npm version patch -w feedbackland-react && npm publish -w feedbackland-react"
   ```

All 100+ other dependencies and scripts at the root are untouched.

### `feedbackland-react/package.json`

One edit:

1. **Add a watch script** for active library development (recommended for the dev workflow described below):
   ```jsonc
   "build:watch": "vite build --watch"
   ```

Everything else stays as-is — `name` (`feedbackland-react`), `version`, `type`, `module`, `types`, `exports`, `files: ["dist"]`, `peerDependencies` (`react`, `react-dom`), and the existing scripts (`dev`, `build`, `prepare: "npm run build"`, `prepublishOnly: "npm run build"`, `preview`).

The library's `peerDependencies` for React stays as `^17 || ^18 || ^19` to keep the npm package usable by external consumers on older React versions.

### Why the symlink works transparently

- npm sees `"feedbackland-react"` in the workspaces list.
- It creates `node_modules/feedbackland-react` as a symlink to `../feedbackland-react/`.
- When Next.js / TypeScript / anything else does `import "feedbackland-react"`, normal Node resolution finds the symlinked `package.json`, reads its `exports."."` → `./dist/feedbackland-react.js`. Same resolution path as the npm-registry version.
- For external consumers (people who `npm install feedbackland-react` from the registry), nothing changes — they still get the published tarball with `dist/` only, because of the `files: ["dist"]` field.

## Dev workflow & build pipeline

The library's `dist/` is built at three triggers — all already covered by existing scripts plus the new `build:watch`:

1. **On `npm install` at root** — the existing `"prepare": "npm run build"` script in `feedbackland-react/package.json` runs automatically. npm workspaces honor `prepare` for each workspace package on install (npm 7+). Result: after `npm install`, `feedbackland-react/dist/` exists and the Next.js app can resolve imports. If for any reason `prepare` doesn't fire (older npm, edge cases), the explicit fallback is `npm run build -w feedbackland-react` — covered by the verification checklist below.

2. **During active library development** — open two terminals:
   - Terminal A: `npm run build:watch -w feedbackland-react` (rebuilds `dist/` on every save)
   - Terminal B: `npm run dev` (Next.js Turbopack; watches `node_modules/feedbackland-react/dist/` through the symlink and hot-reloads)

   On Windows + Turbopack + symlinks, file-watching is usually reliable but occasionally needs a hard refresh. Fallback: rerun `npm run build -w feedbackland-react` and refresh the browser.

3. **Before production builds** — the modified root `build` script runs `npm run build -w feedbackland-react && next build`.

**No predev hook.** A `"predev": "npm run build -w feedbackland-react"` would add several seconds of friction on every `npm run dev` even when the library wasn't touched. The `prepare` script + explicit `build:watch` workflow is enough.

**Unchanged:** `npm run dev`, `npm run start`, `npm run lint`, all migration scripts.

## Publishing workflow

From the repo root:

```bash
npm version patch -w feedbackland-react           # bumps inner version
npm publish -w feedbackland-react                  # builds (via prepublishOnly) and publishes
git add feedbackland-react/package.json package-lock.json
git commit -m "release: feedbackland-react@X.Y.Z"
git tag feedbackland-react-vX.Y.Z
git push && git push --tags
```

`npm publish -w` runs `prepublishOnly` (= `npm run build`) inside the workspace, then publishes only the files matched by `feedbackland-react`'s `files` field (`["dist"]`). External consumers get a clean tarball — the rest of the monorepo doesn't leak in.

## Token security (must precede any commit)

`feedbackland-react/.npmrc` currently contains a literal npm publish token (`//registry.npmjs.org/:_authToken=npm_...`). Treat it as compromised.

1. **Rotate at npmjs.com:** revoke the existing token; generate a fresh "Automation" or "Granular Access" token.
2. **Don't recreate the file in the integrated repo.** Root `.gitignore` will explicitly cover `feedbackland-react/.npmrc` (Section: gitignore updates).
3. **Use the new token at publish time:**
   - **Local solo dev (preferred):** `npm config set //registry.npmjs.org/:_authToken <NEW_TOKEN>` — stores in `~/.npmrc` (your home dir, not the repo).
   - **CI (future):** set `NODE_AUTH_TOKEN` and have the workflow write a temporary `.npmrc` at publish time. Not needed yet.
4. **Pre-push verification:** `git ls-files | grep -i npmrc` and `git diff --staged | grep -iE "authToken|npm_[A-Za-z0-9]"` — both must be empty.

## `.gitignore` updates

Append to root `.gitignore`:

```gitignore
# workspace package: build output and lockfile/.env safety
feedbackland-react/dist/
feedbackland-react/node_modules/
feedbackland-react/.npmrc
feedbackland-react/.env*
feedbackland-react/*.tsbuildinfo
```

The existing root patterns (`/node_modules`, `*.tsbuildinfo`, `.env*`) are anchored or only match at the top level; the explicit nested entries make intent obvious. The `dist/` ignore matches the inner repo's existing `.gitignore` behavior — `dist/` is always rebuilt locally, never committed.

## Migration sequence

Executed in order, on a feature branch:

```bash
git checkout -b integrate-feedbackland-react
```

1. **Rotate the npm token** (per Token security above) before touching the repo.
2. **Push every branch and tag of the inner repo** to its GitHub remote one last time, so the standalone GitHub repo holds the canonical history as a backup:
   ```bash
   cd feedbackland-react
   git push origin --all
   git push origin --tags
   cd ..
   ```
3. **Delete the inner `.git/`:**
   ```bash
   rm -rf feedbackland-react/.git
   ```
   `git status` will flip from `?? feedbackland-react/` (untracked, opaque) to seeing every file inside.
4. **Delete redundant nested artifacts:**
   ```bash
   rm feedbackland-react/.npmrc
   rm feedbackland-react/package-lock.json
   rm -rf feedbackland-react/node_modules
   rm -rf feedbackland-react/dist
   ```
5. **Edit `package.json` files** per the section above.
6. **Edit root `.gitignore`** per the section above.
7. **Run `npm install` at root.** This creates the symlink, hoists shared deps, generates a single fresh root `package-lock.json`, and triggers the workspace's `prepare` (which builds `feedbackland-react/dist/`).
8. **Run verification (next section).**
9. **Commit as one cohesive change**, e.g.:
   ```
   integrate feedbackland-react into monorepo via npm workspaces

   - drop standalone repo, fold source into feedbackland-react/
   - add workspace declaration; consume locally via symlink
   - rotate leaked npm token
   ```
10. **Push the branch, open a PR, merge to main.**
11. **After merge:** archive the standalone `github.com/feedbackland/feedbackland-react` repo on GitHub (Settings → Archive). Don't delete — keeps the historical commits, issues, PRs as a read-only reference.

**Key invariant after cleanup:** exactly one `.git/`, one `package.json` per workspace, one `package-lock.json` total, one `node_modules/` (hoisted). No duplicates anywhere.

## Verification checklist

Run after `npm install` and before committing:

1. **Single-repo invariant:**
   ```bash
   find feedbackland-react -name ".git" -maxdepth 2   # should output nothing
   git status                                          # should show real files inside feedbackland-react/, not just the folder
   ```
2. **Symlink wiring:**
   ```bash
   ls -la node_modules/feedbackland-react              # should show a symlink (or junction on Windows) → ../feedbackland-react
   ```
3. **Library build artifact exists:**
   ```bash
   ls feedbackland-react/dist/feedbackland-react.js feedbackland-react/dist/src/index.d.ts
   ```
4. **Next.js dev server boots and resolves the import:** `npm run dev`, then open the `/widget-docs` page (it imports `FeedbackButton` at `components/app/widget-docs/index.tsx`). Confirm the widget renders. Critical end-to-end check.
5. **Production build succeeds:** `npm run build`. Confirms the library + Next.js consume cleanly without needing `transpilePackages`.
6. **Types resolve in IDE:** open `components/app/widget-docs/index.tsx`; hovering over `FeedbackButton` should show types from `./feedbackland-react/dist/src/`. No red squiggles.
7. **No leaked secrets staged:**
   ```bash
   git ls-files --others --exclude-standard | grep -i npmrc    # empty
   git diff --cached | grep -iE "authToken|npm_[A-Za-z0-9]"     # empty
   ```
8. **Publish dry-run** (proves external consumers still get a clean tarball):
   ```bash
   npm publish --dry-run -w feedbackland-react
   ```
   Output should list `dist/...` files only — no `src/`, no `node_modules/`, no monorepo files.

## Rollback paths

- **Verification fails before commit:** `git checkout main && git clean -fd`. Re-clone the inner repo from `github.com/feedbackland/feedbackland-react` if the working copy is wiped.
- **Issue discovered post-merge:** revert the merge commit (`git revert -m 1 <commit>`); re-clone inner repo from its GitHub remote (don't archive yet — that's why archiving is the last step).
- **Catastrophic case:** the inner repo's GitHub remote is the source-of-truth backup throughout the migration window.

**One-way doors flagged:**

- Archiving the standalone GitHub repo is reversible (un-archive in Settings).
- Token rotation is one-way (intentional — old token is dead).
- Deleting `feedbackland-react/.git/` is the only truly irreversible local act, and the GitHub remote backs it up.

## Out of scope (deliberately deferred)

- Conventional `apps/` + `packages/` monorepo layout (Approach 2 in brainstorm) — not worth the file-move blast radius for two projects.
- Turborepo / Nx orchestration (Approach 3 in brainstorm) — overkill for the trivial 2-package dependency graph.
- Conditional `exports` to consume the library from source in dev (no `dist/` build step) — adds package.json complexity; the `build:watch` workflow is simpler and sufficient.
- A Changesets / release-please workflow — manual `npm version` + `npm publish` is fine for a solo maintainer.
- CI for automated publishing — not needed yet; revisit once publishing cadence justifies it.
- Tightening the library's React peerDependency to `^19` only — leaves npm package usable by older-React consumers.
