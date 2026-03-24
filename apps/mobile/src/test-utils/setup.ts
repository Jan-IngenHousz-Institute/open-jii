// Global test setup — keep minimal so existing tests are unaffected.
// react-native is aliased to src/test-utils/mocks/react-native.ts in vitest.config.ts

// Required for react-test-renderer's act() to work in a non-DOM environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
