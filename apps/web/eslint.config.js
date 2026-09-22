import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";
import nextjsConfig from "@repo/eslint-config/nextjs";
import reactConfig from "@repo/eslint-config/react";
import { themeTokenGuard } from "@repo/eslint-config/theme-tokens";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**", "next-env.d.ts", ".releaserc.js"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
  ...themeTokenGuard,
];
