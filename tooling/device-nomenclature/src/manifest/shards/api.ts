import { defineRules } from "../rule.js";

export const apiRules = defineRules([
  {
    id: "api.family-contract-values",
    surface: "api",
    category: "keep-compatibility",
    granularity: "content-pattern",
    paths: [
      "packages/api/src/domains/protocol/protocol.schema.ts",
      "packages/api/src/domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.schema.ts",
    ],
    pattern: "[\"']multispeq[\"']",
    caseSensitive: true,
    disposition: "preserve",
    target: "multispeq API family value",
    rationale: "API family strings are externally observable and persisted.",
    compatibilityBoundary: "API and workbook family values",
  },
  {
    id: "api.product-fixtures",
    surface: "api",
    category: "fixture",
    granularity: "file",
    paths: ["packages/api/src/**/*.spec.ts", "packages/api/src/**/*.test.ts"],
    disposition: "fixture-only",
    target: "MultiSpeQ schema and transform fixtures",
    rationale: "These tests intentionally exercise the MultiSpeQ family value and command shapes.",
    compatibilityBoundary: null,
  },
  {
    id: "api.device-profile-canonical-spelling",
    surface: "api",
    category: "keep-product-specific",
    granularity: "file",
    paths: ["packages/api/src/domains/device/device-profile.ts"],
    disposition: "preserve",
    target: "canonical MultiSpeQ product spelling in the shared device profile",
    rationale:
      "The shared device profile is the authority for the canonical MultiSpeQ product spelling used for display; the name is preserved, not renamed.",
    compatibilityBoundary: "canonical product spelling",
  },
  {
    id: "api.multispeq-command-contract",
    surface: "api",
    category: "keep-product-specific",
    granularity: "content-pattern",
    paths: [
      "packages/api/src/domains/workbook/device-command.schema.ts",
      "packages/api/src/domains/protocol/protocol-validator.ts",
    ],
    pattern: "multispeq",
    disposition: "preserve",
    target: "MultiSpeQ protocol command schema",
    rationale:
      "These schemas validate actual MultiSpeQ protocol commands rather than generic transport behavior.",
    compatibilityBoundary: "workbook and protocol schema",
  },
]);
