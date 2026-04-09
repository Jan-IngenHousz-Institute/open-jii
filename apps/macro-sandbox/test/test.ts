import { describe, it, expect } from "vitest";

import {
  invokeLambda,
  loadTestData,
  targetLanguages,
  withLanguage,
  assertValidEnvelope,
} from "./helpers.js";
import type { TestCase } from "./helpers.js";

const samples = loadTestData("samples.json");
const intensive = loadTestData("intensive.json");
const security = loadTestData("security.json");

describe("samples", () => {
  for (const testCase of samples) {
    const languages = targetLanguages(testCase);

    for (const lang of languages) {
      const tc = lang === testCase.language ? testCase : withLanguage(testCase, lang);
      const label = languages.length > 1 ? `${tc.name} [${lang}]` : tc.name;

      it(label, { timeout: (tc.timeout + 30) * 1000 }, async () => {
        const { response, status } = await invokeLambda(tc);

        expect(status).toBe(200);
        assertValidEnvelope(response);
        expect(response.status).toBe("success");
        expect(response.results).toHaveLength(tc.items.length);

        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          expect(result).toHaveProperty("id");
          expect(result.success).toBe(true);
          expect(result.output).toBeDefined();
          expect(typeof result.output).toBe("object");

          if (tc.expect.output?.[i]) {
            expect(result.output).toEqual(tc.expect.output[i]);
          }
        }
      });
    }
  }
});

/** Duplicate the single item in a test case to create a batch. */
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
          const { response, status } = await invokeLambda(tc, {
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

              if (base.expect.output?.[0]) {
              expect(result.output).toEqual(base.expect.output[0]);
            }
          }
        });
      }
    }
  }
});

// Group security tests by language
const byLanguage = new Map<string, typeof security>();
for (const tc of security) {
  for (const lang of targetLanguages(tc)) {
    if (!byLanguage.has(lang)) byLanguage.set(lang, []);
    byLanguage.get(lang)?.push(lang === tc.language ? tc : withLanguage(tc, lang));
  }
}

describe("security", () => {
  for (const [language, cases] of byLanguage) {
    describe(language, () => {
      for (const tc of cases) {
        it(tc.name, { timeout: (tc.timeout + 30) * 1000 }, async () => {
          const { response, status } = await invokeLambda(tc, {
            timeoutMs: (tc.timeout + 30) * 1000,
          });

          expect(status).toBe(200);
          assertValidEnvelope(response);

          if (tc.expect.success) {
            expect(response.status, "Expected response success").toBe("success");
          } else {
            expect(response.status, "Expected response error").toBe("error");
          }

          if (response.status === "success") {
            const anyItemFail = response.results.some((r) => r.success === false || "error" in r);
            expect(
              anyItemFail,
              tc.expect.error
                ? "Expected at least one item-level error"
                : "Expected all items to succeed",
            ).toBe(tc.expect.error);
          }

          if (response.status === "success") {
            for (const result of response.results) {
              expect(result).toHaveProperty("id");
              expect(typeof result.success).toBe("boolean");
            }
          }
          if (response.status === "error") {
            expect(response.errors).toBeDefined();
            expect(response.errors?.length).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});
