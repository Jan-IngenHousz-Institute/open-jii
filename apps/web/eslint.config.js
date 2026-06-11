import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";
import nextjsConfig from "@repo/eslint-config/nextjs";
import reactConfig from "@repo/eslint-config/react";

const FEATURES = [
  "account",
  "auth",
  "dashboard",
  "experiment-flow",
  "experiment-visualizations",
  "experiments",
  "iot",
  "macros",
  "protocols",
  "workbooks",
];

// Boundary ratchet: accepted exceptions only. Keep these lists empty —
// new violations are hard errors.
const LEGACY_CROSS_FEATURE_FILES = [];

const LEGACY_SHARED_TO_FEATURE_FILES = [];

// Migration-only: features may still import legacy layer dirs while those
// dirs are dissolved into features/ and shared/. Must end empty.
const LEGACY_FEATURE_TO_LEGACY_DIR_FILES = [
  "features/dashboard/components/user-experiments-section.tsx",
];

// restrictEnvAccess also configures no-restricted-imports; flat config
// replaces rather than merges, so every composite below re-includes it.
const envImportPath = {
  name: "process",
  importNames: ["env"],
  message: "Use `import { env } from '~/env'` instead to ensure validated types.",
};

// Exact-match paths: bans the bare feature specifier (a barrel), not deep imports.
const noBarrelPaths = FEATURES.flatMap((feature) => [
  { name: `@/features/${feature}`, message: "No feature barrels — deep-import the concrete module." },
  { name: `~/features/${feature}`, message: "No feature barrels — deep-import the concrete module." },
]);

const noAppImports = {
  group: ["@/app/**", "~/app/**"],
  message:
    "app/ is the routing layer; nothing imports back into it. Server actions live in shared/api.",
};

const noLegacyDirs = {
  group: [
    "@/components/**",
    "~/components/**",
    "@/hooks/**",
    "~/hooks/**",
    "@/util/**",
    "~/util/**",
    "@/lib/**",
    "~/lib/**",
    "~/providers/**",
  ],
  message:
    "features/ must not reach back into the legacy layer dirs; the target lives in @/shared/* or the owning feature.",
};

// A feature's public surface is its hooks/ and domain/; components are private.
const crossFeature = (feature) => ({
  group: [
    "@/features/*/components/**",
    "~/features/*/components/**",
    `!@/features/${feature}/components/**`,
    `!~/features/${feature}/components/**`,
  ],
  message:
    "Another feature's components are private. Import its hooks/ or domain/ instead, or move shared UI to shared/ui.",
});

const featureRule = (feature, severity) => ({
  "no-restricted-imports": [
    severity,
    {
      paths: [envImportPath, ...noBarrelPaths],
      patterns: [crossFeature(feature), noAppImports, noLegacyDirs],
    },
  ],
});

const featureBoundaryBlocks = FEATURES.flatMap((feature) => {
  const legacy = [...LEGACY_CROSS_FEATURE_FILES, ...LEGACY_FEATURE_TO_LEGACY_DIR_FILES].filter(
    (f) => f.startsWith(`features/${feature}/`),
  );
  return [
    {
      files: [`features/${feature}/**`],
      ignores: legacy,
      rules: featureRule(feature, "error"),
    },
    ...(legacy.length ? [{ files: legacy, rules: featureRule(feature, "warn") }] : []),
  ];
});

// domain/ is pure: importable from server and client modules alike, testable
// without rendering. Hooks compose domain + api; never the reverse.
const domainPurityBlocks = FEATURES.map((feature) => ({
  files: [`features/${feature}/domain/**`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          envImportPath,
          ...noBarrelPaths,
          { name: "react", message: "domain/ is pure — no React." },
          { name: "react-dom", message: "domain/ is pure — no React." },
          { name: "next", message: "domain/ is pure — no Next.js." },
          {
            name: "@tanstack/react-query",
            message: "domain/ takes cache data as arguments; hooks own the query layer.",
          },
        ],
        patterns: [
          crossFeature(feature),
          noAppImports,
          noLegacyDirs,
          { group: ["next/**", "react-dom/**"], message: "domain/ is pure — no framework imports." },
          { group: ["@repo/ui/**"], message: "domain/ is pure — no UI imports." },
          {
            group: ["@/shared/api/**", "~/shared/api/**"],
            message: "domain/ never talks to the API layer; hooks compose domain + api.",
          },
          {
            group: ["@/features/*/hooks/**", "~/features/*/hooks/**"],
            message: "domain/ must not import hooks — hooks compose domain, not the reverse.",
          },
        ],
      },
    ],
  },
}));

const sharedRule = (severity) => ({
  "no-restricted-imports": [
    severity,
    {
      paths: [envImportPath],
      patterns: [
        {
          group: ["@/features/**", "~/features/**"],
          message:
            "shared/ must not depend on features/. Move the dependency down to shared/, or wire it from shared/providers.",
        },
        noAppImports,
      ],
    },
  ],
});

const sharedBoundaryBlocks = [
  {
    files: ["shared/**"],
    // providers/ is the composition root; tests wire features the same way.
    ignores: [
      "shared/providers/**",
      "shared/**/*.test.*",
      ...LEGACY_SHARED_TO_FEATURE_FILES,
    ],
    rules: sharedRule("error"),
  },
  ...(LEGACY_SHARED_TO_FEATURE_FILES.length
    ? [{ files: LEGACY_SHARED_TO_FEATURE_FILES, rules: sharedRule("warn") }]
    : []),
];

const appBlocks = [
  {
    files: ["app/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [envImportPath, ...noBarrelPaths] }],
    },
  },
];

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**", "next-env.d.ts", ".releaserc.js"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
  ...featureBoundaryBlocks,
  ...domainPurityBlocks,
  ...sharedBoundaryBlocks,
  ...appBlocks,
];
