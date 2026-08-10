/**
 * Makes `require("typescript")` resolve to the TypeScript 6 compiler API for the
 * ESLint process only.
 *
 * Why this exists: the project pins `typescript@7`, but typescript-eslint reads
 * `ts.versionMajorMinor` and hard-throws on major >= 7 (see
 * node_modules/typescript-eslint/dist/index.js). Its own error message points at
 * TypeScript 7's "Running side-by-side with TypeScript 6.0" guidance, i.e. the
 * `@typescript/typescript6` package — but typescript-eslint does not yet look for
 * that package itself, so nothing wires the two together. Tracked upstream as
 * https://github.com/typescript-eslint/typescript-eslint/issues/10940.
 *
 * Scope: loaded via `--require` from the `lint` script only. It does not affect
 * `npm run typecheck`, `next build`, or the widget build — those keep using the
 * pinned `typescript@7`. Delete this file and the `--require` flag once
 * typescript-eslint supports TypeScript 7.
 */
const Module = require("node:module");

const TS6 = "@typescript/typescript6";
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request === "typescript") {
    return originalResolve.call(this, TS6, ...rest);
  }

  // Subpath imports (`typescript/lib/...`) — `@typescript/typescript6` ships the
  // same `lib` layout, so the tail maps across unchanged.
  if (request.startsWith("typescript/")) {
    return originalResolve.call(
      this,
      `${TS6}/${request.slice("typescript/".length)}`,
      ...rest,
    );
  }

  return originalResolve.call(this, request, ...rest);
};
