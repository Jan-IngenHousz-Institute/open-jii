import baseConfig from "@repo/eslint-config/base";
import reactConfig from "@repo/eslint-config/react";

const FEATURES = [
  "alerts",
  "auth",
  "calibration",
  "connection",
  "experiments",
  "home",
  "measurement-flow",
  "profile",
  "recent-measurements",
];

// Boundary ratchet: files below predate the boundary rules and are being
// migrated (see plan stages). Shrink this list; never add to it.
const LEGACY_CROSS_FEATURE_FILES = [
  "src/features/experiments/hooks/use-precached-experiment-data.ts",
  "src/features/experiments/screens/experiments-screen/components/table-detail-modal.tsx",
  "src/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/analysis-node/analysis-node.tsx",
  "src/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/questions-only-submit-node.tsx",
  "src/features/profile/screens/profile-screen/profile-screen.tsx",
];

const LEGACY_SHARED_TO_FEATURE_FILES = [
  "src/shared/api/fetcher.ts",
  "src/shared/db/prefetch-offline-data.ts",
  "src/shared/measurements/convert-cycle-answers-to-array.ts",
  "src/shared/measurements/convert-cycle-answers-to-array.test.ts",
  "src/shared/ui/widgets/device-chip.tsx",
  "src/shared/ui/widgets/dev-indicator.tsx",
];

// A feature's public surface is its hooks/stores/services/utils/types;
// screens and components are private. Shared UI belongs in shared/ui.
const crossFeatureRule = (feature, severity) => ({
  "no-restricted-imports": [
    severity,
    {
      patterns: [
        {
          group: [
            "~/features/*/screens/**",
            "~/features/*/components/**",
            `!~/features/${feature}/screens/**`,
            `!~/features/${feature}/components/**`,
          ],
          message:
            "Another feature's screens/components are private. Import its hooks/stores/services instead, or move shared UI to shared/ui.",
        },
      ],
    },
  ],
});

const featureBoundaryBlocks = FEATURES.flatMap((feature) => {
  const legacy = LEGACY_CROSS_FEATURE_FILES.filter((f) =>
    f.startsWith(`src/features/${feature}/`),
  );
  return [
    {
      files: [`src/features/${feature}/**`],
      ignores: legacy,
      rules: crossFeatureRule(feature, "error"),
    },
    ...(legacy.length
      ? [{ files: legacy, rules: crossFeatureRule(feature, "warn") }]
      : []),
  ];
});

const sharedToFeatureRule = (severity) => ({
  "no-restricted-imports": [
    severity,
    {
      patterns: [
        {
          group: ["~/features/**"],
          message:
            "shared/ must not depend on features/. Move the dependency down to shared/, or wire it from shared/composition.",
        },
      ],
    },
  ],
});

const sharedBoundaryBlocks = [
  {
    files: ["src/shared/**"],
    ignores: ["src/shared/composition/**", ...LEGACY_SHARED_TO_FEATURE_FILES],
    rules: sharedToFeatureRule("error"),
  },
  { files: LEGACY_SHARED_TO_FEATURE_FILES, rules: sharedToFeatureRule("warn") },
];

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".expo/**", "expo-plugins/**", ".releaserc.js"],
  },
  ...baseConfig,
  ...reactConfig,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  ...featureBoundaryBlocks,
  ...sharedBoundaryBlocks,
];
