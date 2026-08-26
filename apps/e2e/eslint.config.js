import baseConfig from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [{ ignores: ["playwright-report/**", "test-results/**"] }, ...baseConfig];
