import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Native flat config. `eslint-config-next` 16 ships its shareable configs as
// flat-config arrays (`Linter.Config[]`), so they are spread in directly rather
// than through a `FlatCompat` wrapper. That drops the dependency on
// `@eslint/eslintrc`, which ESLint 9 still bundles but ESLint 10 does not — so
// this config no longer breaks on the next major.
//
// `next/typescript` pulls in `typescript-eslint`, which hard-throws on
// TypeScript >= 7. `npm run lint` therefore loads scripts/eslint-ts6-resolver.cjs
// to hand that subtree the TS 6 API while the app itself keeps typechecking with
// the pinned `typescript@7` — see that file, and
// https://github.com/typescript-eslint/typescript-eslint/issues/10940.
//
// Rule overrides are scoped to the same file globs the upstream configs use to
// register their plugins: in flat config a rule may only be set for files where
// its plugin is in scope.
const JS_AND_TS = ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const TS_ONLY = ["**/*.{ts,tsx,mts,cts}"];

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "feedbackland-react/dist/**",
      "db/schema.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: JS_AND_TS,
    rules: {
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    files: TS_ONLY,
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // `typescript-eslint/recommended` carries no `files` glob, so its rules also
    // land on plain CommonJS scripts, where `require()` is the correct syntax.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
