// ============================================================
// Integration Tests — samples.json
// ============================================================
// Tests basic and complex macros across all three runtimes.
// These are "happy path" tests: real macro scripts that should
// execute successfully and return structured output.
// ============================================================
import { describe, it, expect } from "vitest";

import {
  invokeLambda,
  loadTestData,
  targetLanguages,
  withLanguage,
  assertValidEnvelope,
} from "./helpers.js";

const samples = loadTestData("samples.json");

describe("samples", () => {
  for (const testCase of samples) {
    const languages = targetLanguages(testCase);

    for (const lang of languages) {
      const tc = lang === testCase.language ? testCase : withLanguage(testCase, lang);
      const label = languages.length > 1 ? `${tc.name} [${lang}]` : tc.name;

      it(label, { timeout: (tc.timeout + 30) * 1000 }, async () => {
        const { response, status } = await invokeLambda(tc);

        // Lambda RIE should always return 200
        expect(status).toBe(200);

        // Response must have the standard envelope
        assertValidEnvelope(response);

        // Samples must succeed
        expect(response.status).toBe("success");

        // Every item should produce a result
        expect(response.results).toHaveLength(tc.items.length);

        // Each result should be successful with output
        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          expect(result).toHaveProperty("id");
          expect(result.success).toBe(true);
          expect(result.output).toBeDefined();
          expect(typeof result.output).toBe("object");

          // Verify expected output values (from snapshots)
          if (tc.expect.output?.[i]) {
            expect(result.output).toEqual(tc.expect.output[i]);
          }
        }
      });
    }
  }
});
