import { defineRules } from "../rule.js";

export const otherAppRules = defineRules([
  {
    id: "other-app.multispeq-mqtt-tool",
    surface: "other-app",
    category: "keep-product-specific",
    granularity: "path",
    paths: ["apps/tools/multispeq_mqtt_interface/**"],
    disposition: "preserve",
    target: "dedicated MultiSpeQ MQTT interface",
    rationale: "This nested tool intentionally interfaces with MultiSpeQ hardware and APIs.",
    compatibilityBoundary: "published Python module and MQTT behavior",
    coversContents: true,
  },
  {
    id: "other-app.macro-sandbox-compatibility",
    surface: "other-app",
    category: "keep-compatibility",
    granularity: "content-pattern",
    paths: ["apps/macro-sandbox/**"],
    pattern: "multispeq",
    disposition: "preserve",
    target: "legacy MultiSpeQ macro-executor compatibility",
    rationale: "The sandbox deliberately reproduces historical MultiSpeQ macro semantics.",
    compatibilityBoundary: "macro execution compatibility",
  },
  {
    id: "other-app.data-family-values",
    surface: "other-app",
    category: "keep-compatibility",
    granularity: "content-pattern",
    paths: [
      "apps/data/src/notebooks/data_hackathon_2026/Welcome_to_openJII_Data_Hackathon_2026.py",
      "apps/data/src/tasks/project_transfer_task.py",
    ],
    pattern: "multispeq",
    disposition: "preserve",
    target: "MultiSpeQ data-pipeline family and notebook examples",
    rationale:
      "The task emits a persisted family value and the notebook documents actual product data.",
    compatibilityBoundary: "data-pipeline family value",
  },
]);
