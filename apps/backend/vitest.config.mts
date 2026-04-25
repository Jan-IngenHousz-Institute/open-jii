import swc from "unplugin-swc";
import { defineConfig, mergeConfig } from "vitest/config";
import { BaseSequencer } from "vitest/node";

import { baseConfig } from "@repo/vitest-config/base";

/**
 * Architectural layer ordering for test file execution.
 * Files are sorted bottom-up so pure units run first and integration-heavy
 * presentation tests run last.
 *
 * @see {@link https://vitest.dev/advanced/api/test-specification.html#custom-sequencer Custom Sequencer}
 */
const LAYER_ORDER: [string, number][] = [
  ["/utils/", 0],
  ["/guards/", 1],
  ["/services/", 2],
  ["/repositories/", 3],
  [".adapter.spec.", 3],
  ["/use-cases/", 4],
  ["/presentation/", 5],
  [".controller.spec.", 5],
];

function layerPriority(filepath: string): number {
  for (const [segment, priority] of LAYER_ORDER) {
    if (filepath.includes(segment)) return priority;
  }
  console.warn(
    `[vitest] LayerSequencer: unclassified test file "${filepath}", add a matching segment to LAYER_ORDER.`,
  );
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Custom sequencer that orders test files by architectural layer (bottom-up):
 *   0. utils         - pure functions, no dependencies
 *   1. guards        - request guards
 *   2. services      - module-level services
 *   3. repositories  - data-access layer
 *   4. use-cases     - application layer
 *   5. presentation  - controllers, hooks, webhooks
 *
 * Extends Vitest's {@link BaseSequencer} and overrides `sort()`.
 * Files within the same layer are sorted alphabetically.
 *
 * @see {@link https://vitest.dev/advanced/api/test-specification.html#custom-sequencer Custom Sequencer}
 */
class LayerSequencer extends BaseSequencer {
  async sort(files: Parameters<BaseSequencer["sort"]>[0]) {
    return [...files].sort((a, b) => {
      const pa = layerPriority(a.moduleId);
      const pb = layerPriority(b.moduleId);
      if (pa !== pb) return pa - pb;
      return a.moduleId.localeCompare(b.moduleId);
    });
  }
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [swc.vite()],
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      pool: "threads",
      restoreMocks: true,
      sequence: {
        concurrent: false,
        sequencer: LayerSequencer,
      },
      fileParallelism: false,
      isolate: false,
      include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
      coverage: {
        exclude: [
          // Backend-specific exclusions (extends base config)
          "src/main.ts", // Application entry point
          "src/**/models/**", // Model files (type definitions only)
          "**/*.e2e-spec.ts", // End-to-end test file
          "src/test/**", // Test utilities and setup
          "**/*.spec.ts", // Test files
          "**/*.test.ts", // Test files
          ".releaserc.js", // Semantic release configuration
        ],
      },
    },
  }),
);
