import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: [
      "next/core-web-vitals",
      "next/typescript",
      "plugin:tailwindcss/recommended",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
      "tailwindcss/enforces-shorthand": "warn",
      "tailwindcss/no-custom-classname": [
        "warn",
        {
          whitelist: ["toaster", "destructive"],
        },
      ],
    },
  }),
];

export default eslintConfig;
