import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test-utils/setup.ts"],
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
      "~/": resolve(__dirname, "src") + "/",
      // react-native/index.js uses Flow syntax (`import typeof`) that esbuild
      // and Node cannot parse. Redirect to a minimal stub for all tests.
      "react-native": resolve(__dirname, "src/test-utils/mocks/react-native.ts"),
    },
  },
});
