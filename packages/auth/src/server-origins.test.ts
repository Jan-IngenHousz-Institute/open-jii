import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveAuthCallback } from "./redirects";

vi.mock("better-auth/adapters/drizzle", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { drizzleAdapter: () => memoryAdapter({}) };
});

describe.each([
  ["prod", "https://openjii.org"],
  ["dev", "https://dev.openjii.org"],
])("%s browser origins and sibling return destinations", (environment, baseUrl) => {
  let trustedOrigins: string[] = [];

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENVIRONMENT_PREFIX", environment);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", baseUrl);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.openjii.org");
    vi.stubEnv("AUTH_SECRET", "test-only-origin-contract-0123456789abcdef");
    const { auth } = await import("./server.js");
    trustedOrigins = (await auth.$context).trustedOrigins;
  }, 30_000);

  afterAll(() => vi.unstubAllEnvs());

  it("keeps browser-origin trust separate from approved returns", () => {
    expect(trustedOrigins).toEqual(expect.arrayContaining([baseUrl, "openjii://", "photosynq://"]));
    expect(trustedOrigins).not.toContain("https://equipment.openjii.org");
    expect(trustedOrigins).not.toContain("http://localhost:3100");
    expect(
      resolveAuthCallback("https://equipment.openjii.org/login/openjii", {
        baseUrl,
        environment,
      }),
    ).toBe("https://equipment.openjii.org/login/openjii");
  });
});
