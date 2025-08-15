import { defineProject, mergeConfig } from "vitest/config";
import { baseConfig } from "./base-config.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const setupFilePath = resolve(__dirname, "../setup.js");

export const uiConfig = mergeConfig(
  baseConfig,
  defineProject({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: [setupFilePath],
    },
  })
);