// ============================================================
// Integration Tests — intensive.json
// ============================================================
// Each test case in intensive.json has a single item with a
// complex script. This suite multiplies items to create load,
// verifying the Lambdas handle batches gracefully.
// ============================================================
import { describe, it, expect } from "vitest";

import {
  invokeLambda,
  loadTestData,
  targetLanguages,
  withLanguage,
  assertValidEnvelope,
} from "./helpers.js";
import type { TestCase } from "./helpers.js";

const intensive = loadTestData("intensive.json");

/** Duplicate the single item in a test case to create a batch of `count` items. */
function multiplyItems(tc: TestCase, count: number): TestCase {
  const baseItem = tc.items[0];
  return {
    ...tc,
    items: Array.from({ length: count }, (_, i) => ({
      ...baseItem,
      id: `item-${i + 1}`,
    })),
  };
}

const SCALES = [1, 10, 100] as const;

describe("intensive", () => {
  for (const testCase of intensive) {
    const languages = targetLanguages(testCase);

    for (const lang of languages) {
      const base = lang === testCase.language ? testCase : withLanguage(testCase, lang);
      const prefix = languages.length > 1 ? `${base.name} [${lang}]` : base.name;

      for (const scale of SCALES) {
        const tc = multiplyItems(base, scale);
        const label = `${prefix} ×${scale}`;

        it(label, { timeout: (tc.timeout + 60) * 1000 }, async () => {
          const { response, status, durationMs } = await invokeLambda(tc, {
            timeoutMs: (tc.timeout + 60) * 1000,
          });

          expect(status).toBe(200);
          assertValidEnvelope(response);

          expect(response.status).toBe("success");

          expect(response.results).toHaveLength(scale);
          for (const result of response.results) {
            expect(result).toHaveProperty("id");
            expect(result.success).toBe(true);
            expect(result.output).toBeDefined();

            // All multiplied items should produce the same output as the base
            if (base.expect.output?.[0]) {
              expect(result.output).toEqual(base.expect.output[0]);
            }
          }

          console.log(`    ${label}: ${durationMs.toFixed(0)}ms (${response.status})`);
        });
      }
    }
  }
});
