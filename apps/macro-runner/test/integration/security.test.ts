// ============================================================
// Integration Tests — security.json
// ============================================================
// Sandbox escape and exploit probes. Every test case in this suite
// attempts to break out of the sandboxed execution environment.
//
// Expected behavior:
//   - The Lambda MUST return a valid response (200 + envelope)
//   - The exploit MUST NOT crash the container
//   - Each result item should either:
//     (a) fail with an error (sandbox blocked the attempt), OR
//     (b) succeed with benign output (the exploit was neutralized)
//
// The key assertion: the container remains responsive after every
// exploit attempt. If an exploit kills the container, subsequent
// tests will fail to connect — which is itself a signal.
// ============================================================
import { describe, it, expect, afterAll } from "vitest";

import {
  invokeLambda,
  loadTestData,
  targetLanguages,
  withLanguage,
  assertValidEnvelope,
  baseUrl,
} from "./helpers.js";

const security = loadTestData("security.json");

// Group by language for better reporting
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

          // Container must return a valid HTTP response
          expect(status).toBe(200);

          // Response must have the standard envelope
          assertValidEnvelope(response);

          // Assert expected outcome (two levels)
          //   expect.success → response.status
          //   expect.error   → at least one item has success=false or "error" key
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

      // After all security tests for this language, verify the container
      // is still alive. A crashed container = security vulnerability.
      afterAll(async () => {
        const url = `${baseUrl(language)}/2015-03-31/functions/function/invocations`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: Buffer.from(
              "output['alive'] = True" + (language === "python" ? "" : ""),
            ).toString("base64"),
            items: [{ id: "healthcheck", data: {} }],
            timeout: 5,
            protocol_id: "healthcheck",
          }),
          signal: AbortSignal.timeout(15000),
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.status).not.toBeUndefined();
      });
    });
  }
});
