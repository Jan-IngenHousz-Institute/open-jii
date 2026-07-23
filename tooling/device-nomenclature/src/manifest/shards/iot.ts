import { defineRules } from "../rule.js";

export const iotRules = defineRules([
  {
    id: "iot.multispeq-driver",
    surface: "iot",
    category: "keep-product-specific",
    granularity: "path",
    paths: ["packages/iot/src/driver/multispeq/**"],
    disposition: "preserve",
    target: "MultiSpeQ driver, protocol, commands, and tests",
    rationale: "This directory implements actual MultiSpeQ wire behavior.",
    compatibilityBoundary: "firmware protocol and telemetry",
    coversContents: true,
  },
  {
    id: "iot.family-identification",
    surface: "iot",
    category: "keep-product-specific",
    granularity: "content-pattern",
    paths: ["packages/iot/src/core/**", "packages/iot/src/index.ts"],
    pattern: "multispeq",
    disposition: "preserve",
    target: "MultiSpeQ family identification and public driver export",
    rationale: "IoT owns product identification and the concrete local driver.",
    compatibilityBoundary: "driver family identifier",
  },
  {
    id: "iot.product-fixtures",
    surface: "iot",
    category: "fixture",
    granularity: "file",
    paths: [
      "packages/iot/src/core/identify-device.spec.ts",
      "packages/iot/src/core/types.spec.ts",
      "packages/iot/src/driver/multispeq/driver.spec.ts",
      "packages/iot/src/driver/multispeq/multispeq-protocol-estimator.spec.ts",
    ],
    disposition: "fixture-only",
    target: "MultiSpeQ family-identification and driver test fixtures",
    rationale:
      "Only these four specs intentionally model supported MultiSpeQ family identification and driver behavior. A generic IoT spec that uses MultiSpeQ as a stand-in stays unclassified and fails strict mode instead of being blanket-allowed.",
    compatibilityBoundary: null,
  },
  {
    id: "iot.multispeq-telemetry",
    surface: "iot",
    category: "keep-compatibility",
    granularity: "content-pattern",
    paths: ["packages/iot/src/utils/logger/logger.ts"],
    pattern: "multispeq",
    disposition: "preserve",
    target: "multispeq.command telemetry identity",
    rationale:
      "The event identifies the concrete implementation and may feed historical observability.",
    compatibilityBoundary: "telemetry event identity",
  },
]);
