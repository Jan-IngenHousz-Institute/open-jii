import baseConfig from "@repo/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", "**/__generated/**"],
  },
  ...baseConfig,
  {
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];
