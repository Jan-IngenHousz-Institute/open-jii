import { nestJsConfig } from "@repo/eslint-config/nest";

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ignores: [".releaserc.js"],
  },
  ...nestJsConfig,
];


