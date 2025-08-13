/** @type {import('jest').Config} */
module.exports = {
  displayName: "backend",
  moduleFileExtensions: ["js", "json", "ts"],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/$1",
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
};
