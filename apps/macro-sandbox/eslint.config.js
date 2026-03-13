import baseConfig from "@repo/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["**/*.js", "**/*.mjs", "test/scripts/**", "test/data/**"],
  },
  ...baseConfig,
];
