/** @type {import('jest').Config} */
module.exports = {
  displayName: "backend",
  moduleFileExtensions: ["js", "json", "ts"],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/$1",
    "^@/common/(.*)$": "<rootDir>/common/$1",
    "^@/test/(.*)$": "<rootDir>/test/$1",
    "^@repo/database$": "<rootDir>/../../../packages/database/src/index.ts",
    "^@repo/auth/express$": "<rootDir>/../../../packages/auth/src/express.ts",
    "^@repo/auth/(.*)$": "<rootDir>/../../../packages/auth/src/$1",
    "^@repo/api$": "<rootDir>/../../../packages/api/src/index.ts",
  },
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": ["ts-jest"],
  },
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(@auth[+\\\/]core|@auth[+\\\/]express|@auth[+\\\/]drizzle-adapter|jose|oauth4webapi)).*",
  ],
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/node_modules/**",
    "!**/main.ts",
    "!**/*.model.ts",
    "!**/models/**",
    "!**/test/test-harness.ts",
    "!**/test/**",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
};
