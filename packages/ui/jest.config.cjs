/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@repo/ui/lib/utils$": "<rootDir>/src/lib/utils.ts",
    "^@repo/ui/components$": "<rootDir>/src/components/index.ts",
    "^@repo/ui/(.*)$": "<rootDir>/src/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)",
    "<rootDir>/src/**/*.(test|spec).(ts|tsx|js|jsx)",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test-setup.ts",
    "!src/**/__tests__/**",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
};
