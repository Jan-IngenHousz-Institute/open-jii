import baseConfig from "@repo/eslint-config/base";
import reactConfig from "@repo/eslint-config/react";

const FEATURES = [
  "alerts",
  "auth",
  "connection",
  "experiments",
  "home",
  "measurement-flow",
  "profile",
  "recent-measurements",
];

// Boundary ratchet: accepted exceptions only. Both lists are empty; keep
// them that way and new violations stay hard errors.
const LEGACY_CROSS_FEATURE_FILES = [];

const LEGACY_SHARED_TO_FEATURE_FILES = [];

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
    // composition/ is the sanctioned wiring layer; tests wire features the
    // same way composition does.
    ignores: [
      "src/shared/composition/**",
      "src/shared/**/*.test.*",
      ...LEGACY_SHARED_TO_FEATURE_FILES,
    ],
    rules: sharedToFeatureRule("error"),
  },
  ...(LEGACY_SHARED_TO_FEATURE_FILES.length
    ? [{ files: LEGACY_SHARED_TO_FEATURE_FILES, rules: sharedToFeatureRule("warn") }]
    : []),
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
