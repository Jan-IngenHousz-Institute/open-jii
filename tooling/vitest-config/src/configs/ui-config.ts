import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineProject, mergeConfig } from "vitest/config";

import { baseConfig } from "./base-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const setupFilePath = resolve(__dirname, "../setup.js");

export const uiConfig = mergeConfig(
  baseConfig,

  defineProject({
    plugins: [react()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: [setupFilePath],
    },
  }),
);
