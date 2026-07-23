import { defineRules } from "../rule.js";

export const backendRules = defineRules([
  {
    id: "backend.product-fixtures",
    surface: "backend",
    category: "fixture",
    granularity: "file",
    paths: ["apps/backend/src/**/*.spec.ts", "apps/backend/src/test/test-harness.ts"],
    disposition: "fixture-only",
    target: "MultiSpeQ protocol and family fixtures",
    rationale:
      "Backend tests and their harness intentionally instantiate persisted MultiSpeQ family values.",
    compatibilityBoundary: "API and stored family fixture values",
  },
]);
