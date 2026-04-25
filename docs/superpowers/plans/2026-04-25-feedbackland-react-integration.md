# `feedbackland-react` Monorepo Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the standalone `feedbackland-react` repo into the `feedbackland` Next.js repo as an npm workspace, consumed locally via symlink, while preserving the ability to `npm publish feedbackland-react`.

**Architecture:** Flat layout — Next.js app stays at the repo root, library stays at `feedbackland-react/`. Single root `package.json` declares `workspaces: ["feedbackland-react"]`; npm symlinks the package into `node_modules/` so the app imports the local source via the same `import "feedbackland-react"` it uses today. The library's existing `prepare` script auto-builds `dist/` on `npm install`. Publishing continues via `npm publish -w feedbackland-react`. Inner `.git/` is deleted (clean drop-in); the standalone GitHub repo gets archived as a historical reference. See spec: `docs/superpowers/specs/2026-04-25-feedbackland-react-integration-design.md`.

**Tech Stack:** npm workspaces (npm ≥ 7), Next.js 16, Vite 8, TypeScript 6, React 19, Tailwind CSS v4.

**File summary:**
- **Edit:** `package.json` (root) — add workspace field, remove registry dep, modify build script, add release script
- **Edit:** `feedbackland-react/package.json` — add `build:watch` script
- **Edit:** `.gitignore` (root) — add nested package patterns
- **Delete:** `feedbackland-react/.git/`, `feedbackland-react/.npmrc`, `feedbackland-react/package-lock.json`, `feedbackland-react/node_modules/`, `feedbackland-react/dist/`
- **Generated** (not authored): root `package-lock.json` regenerated, `feedbackland-react/dist/` rebuilt by `prepare`

**Important conventions used in this plan:**
- All paths are relative to repo root: `C:\Users\David\Downloads\feedbackland`
- Bash command examples assume `pwd` is the repo root unless stated otherwise
- "USER ACTION" tasks require interaction outside the terminal (npmjs.com, browser, github.com)
- One commit at the end (per spec: "commit as one cohesive change"); intermediate state is on a feature branch only

---

## Task 1: Rotate the leaked npm token (USER ACTION)

**Why:** `feedbackland-react/.npmrc` contains a real npm publish token (`_authToken=npm_...`) sitting in the local working tree. The token was bundled with the inner repo when the user copied the folder in. Treat it as compromised and rotate before any further work.

**Files:** None edited; this is a manual action on npmjs.com.

- [ ] **Step 1: Revoke the existing token**

  Sign in to https://www.npmjs.com → Account dropdown → "Access Tokens". Find the token currently in `feedbackland-react/.npmrc` (its prefix `npm_9iSDW...` is visible in the file) and click "Delete".

- [ ] **Step 2: Generate a fresh token**

  On the same page → "Generate New Token" → choose **Granular Access Token** (preferred) or "Automation". Scope it to publish access for the `feedbackland-react` package only. Copy the token value once (you won't see it again).

- [ ] **Step 3: Store the new token in user-level npm config**

  ```bash
  npm config set //registry.npmjs.org/:_authToken <NEW_TOKEN>
  ```

  This writes to `~/.npmrc` (your home directory), NOT into the project tree. Verify it landed in the right place:

  ```bash
  cat ~/.npmrc | grep -i authToken
  ```

  Expected output: a single line ending in your new token.

  **Verify the project tree is clean:**

  ```bash
  cat ./.npmrc
  ```
  Expected: just `force=true` (nothing else).

  ```bash
  cat ./feedbackland-react/.npmrc
  ```
  Expected: the old (now-revoked) token. We'll delete this file in Task 4 — for now just confirm it's only this one location.

---

## Task 2: Create feature branch and back up the inner repo to its GitHub remote

**Why:** Everything from Task 3 onward is destructive (deletes the inner `.git/`). The standalone GitHub repo at `github.com/feedbackland/feedbackland-react` is our backup; we want to make sure every local branch/tag is pushed there before we drop the inner repo.

**Files:** None edited.

- [ ] **Step 1: Create the feature branch from `main`**

  ```bash
  git checkout main
  git pull
  git checkout -b integrate-feedbackland-react
  ```

  Expected: `Switched to a new branch 'integrate-feedbackland-react'`.

- [ ] **Step 2: Push every inner branch and tag to the standalone remote**

  ```bash
  cd feedbackland-react
  git push origin --all
  git push origin --tags
  cd ..
  ```

  Expected: `Everything up-to-date` for both pushes (or new objects pushed if any local commits weren't on the remote yet).

- [ ] **Step 3: Confirm the standalone remote has the latest state**

  Open `https://github.com/feedbackland/feedbackland-react` in a browser. Confirm the `main` branch's most recent commit matches the local inner repo's `HEAD`:

  ```bash
  cd feedbackland-react
  git log -1 --oneline
  cd ..
  ```

  Compare the SHA + message to what's shown on GitHub. Expected: a match. If they don't match, **STOP** and resolve before proceeding (push the missing commits, sort out diverged branches).

---

## Task 3: Detach the inner repo by deleting `feedbackland-react/.git/`

**Why:** As long as `feedbackland-react/` contains its own `.git/`, the outer git treats it as an opaque embedded repo (you saw `?? feedbackland-react/` in `git status`). Deleting the inner `.git/` is the moment the outer repo can see and track the files inside.

**Files:**
- Delete: `feedbackland-react/.git/`

- [ ] **Step 1: Delete the inner `.git/` directory**

  ```bash
  rm -rf feedbackland-react/.git
  ```

- [ ] **Step 2: Verify it's gone**

  ```bash
  find feedbackland-react -name ".git" -maxdepth 2
  ```

  Expected output: empty (no matches).

- [ ] **Step 3: Verify outer git now sees the files inside**

  ```bash
  git status --short | head -20
  ```

  Expected: many `??` lines for files inside `feedbackland-react/` (e.g. `?? feedbackland-react/package.json`, `?? feedbackland-react/src/index.ts`, etc.) — NOT just `?? feedbackland-react/`.

  If you still see only `?? feedbackland-react/` (single line), the `.git/` directory wasn't fully removed — re-run Step 1 with admin/elevated privileges if necessary.

---

## Task 4: Remove redundant nested artifacts

**Why:** With workspaces, dependencies, lockfile, and build output live at the workspace root. The inner `.npmrc` carries the rotated-but-still-present old token text and must be deleted.

**Files:**
- Delete: `feedbackland-react/.npmrc`
- Delete: `feedbackland-react/package-lock.json`
- Delete: `feedbackland-react/node_modules/`
- Delete: `feedbackland-react/dist/`

- [ ] **Step 1: Delete the four artifacts in one command**

  ```bash
  rm -f feedbackland-react/.npmrc feedbackland-react/package-lock.json
  rm -rf feedbackland-react/node_modules feedbackland-react/dist
  ```

- [ ] **Step 2: Verify all four are gone**

  ```bash
  ls feedbackland-react/.npmrc feedbackland-react/package-lock.json feedbackland-react/node_modules feedbackland-react/dist 2>&1
  ```

  Expected output: four "No such file or directory" errors (one per path). If any of them still exists, re-run Step 1.

- [ ] **Step 3: Confirm the rest of `feedbackland-react/` is intact**

  ```bash
  ls feedbackland-react/
  ```

  Expected to see: `LICENSE`, `README.md`, `components.json`, `eslint.config.js`, `index.html`, `package.json`, `src`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`. (No `.git`, no `.npmrc`, no `node_modules`, no `dist`, no `package-lock.json`.)

---

## Task 5: Wire up root `package.json` as a workspace root

**Why:** Three edits transform the root package into a workspace root that consumes the local library via symlink instead of from npm registry.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the `workspaces` field**

  Open `package.json`. After the `"private": true,` line (line 4), insert:

  ```jsonc
  "workspaces": ["feedbackland-react"],
  ```

  The top of the file should now read:

  ```jsonc
  {
    "name": "feedbackland",
    "version": "0.1.0",
    "private": true,
    "workspaces": ["feedbackland-react"],
    "scripts": {
      "dev": "next dev --turbopack",
      "build": "next build",
      ...
  ```

- [ ] **Step 2: Modify the `build` script to rebuild the library first**

  In the `scripts` block, change:

  ```jsonc
  "build": "next build",
  ```

  to:

  ```jsonc
  "build": "npm run build -w feedbackland-react && next build",
  ```

- [ ] **Step 3: Add a release convenience script**

  Add this entry to the `scripts` block (after `"start"`, before `"lint"` is fine):

  ```jsonc
  "release:react": "npm version patch -w feedbackland-react && npm publish -w feedbackland-react",
  ```

- [ ] **Step 4: Remove the registry dependency on `feedbackland-react`**

  In `dependencies`, delete the line:

  ```jsonc
  "feedbackland-react": "^2.7.2",
  ```

  (around line 85). Make sure the comma on the line above is still correct after removal.

- [ ] **Step 5: Verify the JSON is valid**

  ```bash
  node -e "JSON.parse(require('fs').readFileSync('./package.json','utf8'));console.log('OK')"
  ```

  Expected: `OK`. If it errors, fix the JSON (likely a trailing comma).

- [ ] **Step 6: Verify the four edits landed correctly**

  ```bash
  grep -E '"workspaces"|"build":|"release:react"|"feedbackland-react"' package.json
  ```

  Expected lines (in some order):
  - `"workspaces": ["feedbackland-react"],`
  - `"build": "npm run build -w feedbackland-react && next build",`
  - `"release:react": "npm version patch -w feedbackland-react && npm publish -w feedbackland-react",`
  - **NO** match for the dependency line `"feedbackland-react": "^2.7.x"` (the dep was removed; only the workspaces/build/release lines should mention `feedbackland-react`).

---

## Task 6: Add `build:watch` to `feedbackland-react/package.json`

**Why:** Enables the two-terminal dev workflow (library auto-rebuild + Next.js dev server) described in the spec.

**Files:**
- Modify: `feedbackland-react/package.json`

- [ ] **Step 1: Add the `build:watch` script**

  In `feedbackland-react/package.json`, in the `scripts` block, after `"build": "tsc -b && vite build",` add:

  ```jsonc
  "build:watch": "vite build --watch",
  ```

  The `scripts` block should now read:

  ```jsonc
  "scripts": {
    "dev": "tsc -b && vite",
    "build": "tsc -b && vite build",
    "build:watch": "vite build --watch",
    "prepare": "npm run build",
    "prepublishOnly": "npm run build",
    "preview": "vite preview"
  },
  ```

- [ ] **Step 2: Verify**

  ```bash
  grep '"build:watch"' feedbackland-react/package.json
  ```

  Expected: one match showing the new line.

  ```bash
  node -e "JSON.parse(require('fs').readFileSync('./feedbackland-react/package.json','utf8'));console.log('OK')"
  ```

  Expected: `OK`.

---

## Task 7: Update root `.gitignore`

**Why:** Anchored patterns at the root (e.g. `/node_modules`) don't match nested workspace folders. Explicit nested entries make intent obvious and prevent accidentally committing the rebuilt `dist/`, the rotated-token file, or workspace `node_modules/`.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append the nested workspace patterns**

  Append these lines to the end of `.gitignore`:

  ```gitignore

  # workspace package: build output and lockfile/.env safety
  feedbackland-react/dist/
  feedbackland-react/node_modules/
  feedbackland-react/.npmrc
  feedbackland-react/.env*
  feedbackland-react/*.tsbuildinfo
  ```

- [ ] **Step 2: Verify**

  ```bash
  tail -8 .gitignore
  ```

  Expected: the six new lines (one blank, one comment, five patterns).

  ```bash
  git check-ignore -v feedbackland-react/dist/feedbackland-react.js 2>&1 || echo "not ignored"
  ```

  Expected: an output mentioning `.gitignore:NN:feedbackland-react/dist/  feedbackland-react/dist/feedbackland-react.js`. (If it says "not ignored", the pattern is wrong — re-check Step 1.)

---

## Task 8: Install dependencies (creates symlink, hoists deps, builds `dist/`)

**Why:** This is the moment of truth. `npm install` at the workspace root will create the symlink, hoist shared deps, write a single fresh `package-lock.json`, and trigger the workspace's `prepare` script which builds `feedbackland-react/dist/`.

**Files:**
- Generated: `package-lock.json` (replaced)
- Generated: `node_modules/` (rebuilt with hoisting)
- Generated: `feedbackland-react/dist/feedbackland-react.js` and `feedbackland-react/dist/src/*.d.ts`

- [ ] **Step 1: Delete the existing root `node_modules/` and lockfile**

  We start from a clean state to avoid stale resolution artifacts:

  ```bash
  rm -rf node_modules package-lock.json
  ```

- [ ] **Step 2: Run `npm install` at the repo root**

  ```bash
  npm install
  ```

  Expected: a long output ending with something like `added N packages in Xs`. The output should include a line indicating the workspace was processed (e.g. `npm warn workspaces` or similar). It should NOT show errors. If `prepare` fails (Vite build error), the install will fail with that error — fix the underlying issue before continuing.

- [ ] **Step 3: Verify the symlink was created**

  ```bash
  ls -la node_modules/feedbackland-react
  ```

  Expected on Linux/macOS: a symlink line like `node_modules/feedbackland-react -> ../feedbackland-react`.
  Expected on Windows: a junction or symlink entry pointing to the workspace folder. On Windows you can also confirm with:

  ```bash
  cmd //c "dir node_modules\\feedbackland-react"
  ```

  Look for `<JUNCTION>` or `<SYMLINKD>` — both indicate proper linking.

- [ ] **Step 4: Verify the library `dist/` was built by `prepare`**

  ```bash
  ls feedbackland-react/dist/feedbackland-react.js feedbackland-react/dist/src/index.d.ts
  ```

  Expected: both files listed (no errors).

  If `dist/` is missing, the `prepare` script didn't fire (older npm, or some edge case). Run the build manually:

  ```bash
  npm run build -w feedbackland-react
  ```

  Then re-check.

- [ ] **Step 5: Verify there's only one lockfile**

  ```bash
  find . -name "package-lock.json" -not -path "./node_modules/*" -not -path "./.next/*"
  ```

  Expected: a single line — `./package-lock.json`. If `feedbackland-react/package-lock.json` shows up, delete it (`rm feedbackland-react/package-lock.json`) and re-run `npm install` from Step 2.

---

## Task 9: Verify the Next.js dev server boots and resolves the local library (USER ACTION)

**Why:** This is the critical end-to-end check. It proves the symlink + Next.js + library exports all wire up correctly. The widget docs page at `components/app/widget-docs/index.tsx` does `import { FeedbackButton } from "feedbackland-react"` — exactly what we're testing.

**Files:** None edited; this is a runtime check.

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

  Expected: Next.js starts, prints `Local: http://localhost:3000` (or similar). No errors about unresolved `feedbackland-react`.

- [ ] **Step 2: Open the widget docs page in a browser**

  Navigate to the page that renders the widget docs. The exact route depends on the app's routing — find it by:

  ```bash
  grep -rn "widget-docs" app/ 2>/dev/null
  ```

  Visit the corresponding URL (e.g. `http://localhost:3000/<path>` for the page that imports `<FeedbackButton />`).

- [ ] **Step 3: Confirm the widget renders**

  Visually confirm the FeedbackButton component renders without errors. Open the browser DevTools console — it should be free of `Module not found`, `Failed to resolve`, or similar errors related to `feedbackland-react`.

- [ ] **Step 4: Confirm the import is resolving via the symlink (not stale cache)**

  In another terminal:

  ```bash
  ls -la node_modules/feedbackland-react/dist/feedbackland-react.js
  ```

  Then:

  ```bash
  ls -la feedbackland-react/dist/feedbackland-react.js
  ```

  Both should resolve to the same underlying file (size, mtime should match). They are the same file because of the symlink.

- [ ] **Step 5: Stop the dev server**

  Ctrl+C in the terminal running `npm run dev`. Expected: a clean shutdown.

---

## Task 10: Verify the production build succeeds

**Why:** Confirms the modified root `build` script chains library build + `next build` correctly, and that the prebuilt ESM `dist/` is consumed cleanly by Next.js without needing `transpilePackages`.

**Files:** Generated artifacts only (`.next/`, `feedbackland-react/dist/`).

- [ ] **Step 1: Run the production build from the repo root**

  ```bash
  npm run build
  ```

  Expected output sequence:
  1. `> npm run build -w feedbackland-react` runs first → Vite builds the library
  2. `> next build` runs after → compiles the Next.js app
  3. Final output: route table from Next.js (`Route (app)`, `○ /...` etc.)

  Expected: completes with no errors. If Next.js complains about `feedbackland-react` (e.g. import resolution, ESM/CJS interop), STOP and surface the error — likely the `dist/` wasn't built or the `exports` field has an issue.

- [ ] **Step 2: Verify `.next/` was generated**

  ```bash
  ls .next/build-manifest.json
  ```

  Expected: file exists.

---

## Task 11: Verify no secrets are about to be committed

**Why:** The rotated-but-still-present old npm token text was removed in Task 4, but verify rigorously before any commit.

**Files:** None edited.

- [ ] **Step 1: Stage the migration changes**

  Stage everything currently modified or untracked (we'll commit them in Task 12). For now this is just to populate the staging area for the secret scan:

  ```bash
  git add -A
  ```

- [ ] **Step 2: Scan staged content for npm tokens or `.npmrc` files**

  ```bash
  git diff --cached | grep -iE "authToken|npm_[A-Za-z0-9]{20,}" || echo "CLEAN: no token-like strings staged"
  ```

  Expected: `CLEAN: no token-like strings staged`. If anything matches, STOP — find the offending file and remove it from the staging area before continuing.

- [ ] **Step 3: Confirm no `.npmrc` files are tracked anywhere in the workspace package**

  ```bash
  git ls-files feedbackland-react | grep -i npmrc || echo "CLEAN: no .npmrc tracked"
  ```

  Expected: `CLEAN: no .npmrc tracked`. The root `.npmrc` (with just `force=true`) should still be tracked at the repo root — that's fine; it has no token.

- [ ] **Step 4: Sanity-check what's about to be committed**

  ```bash
  git status --short
  ```

  Expected: a list of modified/new files including `package.json`, `.gitignore`, `feedbackland-react/package.json`, `package-lock.json`, and many new `feedbackland-react/...` files (everything that was inside the old inner repo). NO entries for `feedbackland-react/.git`, `feedbackland-react/.npmrc`, `feedbackland-react/node_modules`, `feedbackland-react/dist`, or `feedbackland-react/package-lock.json`.

  If any of those forbidden entries appear in the status, your `.gitignore` patterns aren't matching — go back to Task 7 and fix.

---

## Task 12: Verify external publish still produces a clean tarball (dry-run)

**Why:** Proves consumers who `npm install feedbackland-react` from the registry still get just the `dist/` (no monorepo files leak into the published tarball).

**Files:** None edited.

- [ ] **Step 1: Run a dry-run publish from the workspace**

  ```bash
  npm publish --dry-run -w feedbackland-react
  ```

  Expected output: a `Tarball Contents` section listing files. The list MUST contain only:
  - `package.json`
  - `LICENSE` (if npm includes it automatically)
  - `README.md` (if npm includes it automatically)
  - `dist/feedbackland-react.js`
  - `dist/src/*.d.ts` files

  It MUST NOT contain: `src/`, `node_modules/`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`, `components.json`, or any file outside `feedbackland-react/`.

  This confirms the `files: ["dist"]` field still constrains the tarball correctly.

- [ ] **Step 2: Note the `npm notice package size`**

  Confirm the reported package size is in the same ballpark as the previous published version (a few hundred KB at most). A surprise jump (e.g. > 5 MB) signals something leaked in.

---

## Task 13: Commit the migration as one cohesive change

**Why:** Per the spec, this is a single atomic change — easy to revert as a unit if something is discovered later.

**Files:** Stages everything changed in Tasks 3–8.

- [ ] **Step 1: Confirm staging from Task 11 is still current**

  ```bash
  git status --short | head -20
  ```

  Expected: many `M` and `A` lines (modified and added). If the staging area was reset since Task 11, re-stage:

  ```bash
  git add -A
  ```

  Then re-run the secret scan from Task 11 Steps 2–4 before continuing.

- [ ] **Step 2: Create the commit**

  ```bash
  git commit -m "$(cat <<'EOF'
  feat: integrate feedbackland-react into monorepo via npm workspaces

  - Drop standalone repo; fold source into feedbackland-react/ workspace
  - Add workspaces declaration; consume locally via symlink
  - Remove registry dep on feedbackland-react@^2.7.2
  - Add build:watch script for active library development
  - Chain library build before next build in root build script
  - Add release:react convenience script
  - Update .gitignore for nested workspace artifacts
  - Rotate leaked npm publish token (out-of-band)

  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  EOF
  )"
  ```

  Expected: a commit summary line `[integrate-feedbackland-react <SHA>] feat: integrate feedbackland-react into monorepo via npm workspaces` with N files changed.

- [ ] **Step 3: Verify the commit looks right**

  ```bash
  git log --stat -1
  ```

  Expected:
  - `package.json` modified (small diff)
  - `feedbackland-react/package.json` modified (small diff)
  - `.gitignore` modified (small diff)
  - `package-lock.json` modified (large diff — expected, it absorbed the workspace's deps)
  - Many `feedbackland-react/...` files added (the inner repo's source becoming tracked outer-repo content)

---

## Task 14: Push the branch and merge to `main`

**Why:** Lands the integration on the canonical branch. Until now, all changes have been local on `integrate-feedbackland-react`.

**Files:** None edited.

- [ ] **Step 1: Push the branch**

  ```bash
  git push -u origin integrate-feedbackland-react
  ```

  Expected: a successful push, with a `Create a pull request` URL printed by the GitHub remote.

- [ ] **Step 2: (Recommended) Open and merge a PR**

  Use the URL from Step 1 to open a PR titled `Integrate feedbackland-react into monorepo via npm workspaces`. Reference this plan and the spec in the description. Merge when GitHub checks (if any) pass.

  Or, for a solo project where you'd merge immediately, fast-forward locally:

  ```bash
  git checkout main
  git merge --ff-only integrate-feedbackland-react
  git push origin main
  ```

- [ ] **Step 3: Verify `main` reflects the integration**

  ```bash
  git log -1 --oneline
  ```

  Expected: the commit from Task 13 is on `main` at the tip.

---

## Task 15: Archive the standalone GitHub repo (USER ACTION)

**Why:** Final step — preserves history and metadata (issues, PRs, old commit hashes) as a read-only reference, without anyone accidentally pushing new commits to the now-defunct repo.

**Files:** None edited; this is a manual action on GitHub.

- [ ] **Step 1: Add a deprecation notice to the standalone repo's README (optional but kind to past users)**

  Visit `https://github.com/feedbackland/feedbackland-react`. Edit `README.md` from the GitHub web UI, prepend:

  ```markdown
  > **⚠️ Repo archived as of 2026-04-25.** Source code now lives at
  > [feedbackland/feedbackland](https://github.com/feedbackland/feedbackland)
  > under `feedbackland-react/`. The npm package
  > `feedbackland-react` continues to be published from there.
  ```

  Commit that change to the standalone repo's `main` branch.

- [ ] **Step 2: Archive the repo**

  In the standalone repo: Settings → scroll to bottom → "Archive this repository" → confirm.

  Expected: the repo turns to read-only mode; banner at the top reads "This repository has been archived by the owner. It is now read-only."

- [ ] **Step 3: Verify the consolidated repo can still be cloned and built fresh**

  As a final smoke test (from a different directory or a temp clone):

  ```bash
  cd /tmp
  git clone https://github.com/feedbackland/feedbackland.git feedbackland-fresh
  cd feedbackland-fresh
  npm install
  npm run build
  ```

  Expected: clone, install, build all succeed. The library's `dist/` gets built by `prepare`; Next.js builds the app cleanly. This proves a fresh contributor (or you on a new machine) can onboard with just `git clone && npm install && npm run build`.

  Clean up:

  ```bash
  cd ..
  rm -rf feedbackland-fresh
  ```

---

## Post-Migration Reference Card

After this plan is complete, day-to-day workflows are:

**Run the app in dev (no library changes):**
```bash
npm run dev
```

**Develop the library + app together:**
```bash
# Terminal A
npm run build:watch -w feedbackland-react
# Terminal B
npm run dev
```

**Production build:**
```bash
npm run build
```

**Publish a new version of `feedbackland-react` to npm:**
```bash
npm run release:react              # patch bump + publish
# or for explicit version control:
npm version <patch|minor|major> -w feedbackland-react
npm publish -w feedbackland-react
git add feedbackland-react/package.json package-lock.json
git commit -m "release: feedbackland-react@X.Y.Z"
git tag feedbackland-react-vX.Y.Z
git push && git push --tags
```

---

## Self-Review Notes

- **Spec coverage:** All sections of the spec map to tasks: layout (Tasks 3–4), package.json edits (Tasks 5–6), dev workflow (covered by Task 6 + reference card), publishing (Task 12 + reference card), token security (Tasks 1, 4, 11), `.gitignore` (Task 7), migration sequence (Tasks 1–15 mirror it), verification checklist (Tasks 8–12), rollback paths (implicit — feature branch in Task 2, GitHub backup in Task 2, archive-not-delete in Task 15).
- **Type consistency:** No conflicting names — only `feedbackland-react` (workspace name), `FeedbackButton` (export), `dist/`, `build:watch` are used; consistent across tasks.
- **No placeholders:** Every command and code snippet is concrete. No "TBD", "appropriate error handling", or "implement later".
- **One-way doors flagged in-task:** Token rotation (Task 1), `.git/` deletion (Task 3), branch merge (Task 14), GitHub archive (Task 15) — each has explicit verification before and rollback path on the spec.
