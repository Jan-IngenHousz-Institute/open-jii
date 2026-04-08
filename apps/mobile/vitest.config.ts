import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: [
        [
          "json",
          {
            file: "../coverage.json",
          },
        ],
        "text",
      ],
      enabled: true,
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.config.*", "**/*.setup.*"],
    },
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
      "~/": resolve(__dirname, "src") + "/",
    },
  },
});
