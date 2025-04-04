/** @type {import('jest').Config} */
const config = {
  projects: [
    "<rootDir>/apps/backend/jest.config.js",
    // Add other project test configs here as needed
    // '<rootDir>/packages/ui/jest.config.js',
  ],
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.test.ts", "**/*.test.tsx"],
  collectCoverageFrom: [
    "**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/.next/**",
  ],
};

module.exports = config;
