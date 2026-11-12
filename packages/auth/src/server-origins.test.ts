import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAuthCallback } from "./redirects";

vi.mock("better-auth/adapters/drizzle", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { drizzleAdapter: () => memoryAdapter({}) };
});

afterEach(() => vi.unstubAllEnvs());

describe("browser origins and sibling return destinations", () => {
  it.each([
    ["prod", "https://openjii.org"],
    ["dev", "https://dev.openjii.org"],
  ])(
    "keeps %s browser-origin trust separate from approved returns",
    async (environment, baseUrl) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ENVIRONMENT_PREFIX", environment);
      vi.stubEnv("NEXT_PUBLIC_BASE_URL", baseUrl);
      vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.openjii.org");
      vi.stubEnv("AUTH_SECRET", "test-only-origin-contract-0123456789abcdef");
      const { auth } = await import("./server.js");
      const context = await auth.$context;
      expect(context.trustedOrigins).toEqual(
        expect.arrayContaining([baseUrl, "openjii://", "photosynq://"]),
      );
      expect(context.trustedOrigins).not.toContain("https://equipment.openjii.org");
      expect(context.trustedOrigins).not.toContain("http://localhost:3100");
      expect(
        resolveAuthCallback("https://equipment.openjii.org/login/openjii", {
          baseUrl,
          environment,
        }),
      ).toBe("https://equipment.openjii.org/login/openjii");
    },
  );
});
