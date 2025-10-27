import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { expect, afterEach, beforeAll, vi } from "vitest";

expect.extend(matchers);

// Set up test environment variables
beforeAll(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-posthog-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://test.posthog.com");
});

afterEach(() => {
  cleanup();
});
