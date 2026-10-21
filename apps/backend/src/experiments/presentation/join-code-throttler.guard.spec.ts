import { BadRequestException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ThrottlerStorageService } from "@nestjs/throttler";

import type { ClientAddressRequest } from "@repo/auth/client-address";

import { JoinCodeThrottlerGuard } from "./join-code-throttler.guard";

class TestGuard extends JoinCodeThrottlerGuard {
  track(request: ClientAddressRequest & { session?: { user?: { id: string } } }) {
    return this.getTracker(request);
  }
}

describe("join-code identity", () => {
  const guard = new TestGuard([], new ThrottlerStorageService(), new Reflector());
  beforeEach(() => vi.stubEnv("AUTH_CLIENT_ADDRESS_MODE", "cloudfront-alb"));
  afterEach(() => vi.unstubAllEnvs());

  it("keeps authenticated users separate even behind the same address", async () => {
    const headers = { "x-forwarded-for": "198.51.100.1, 203.0.113.2" };
    expect(await guard.track({ headers, session: { user: { id: "one" } } })).toBe("one");
    expect(await guard.track({ headers, session: { user: { id: "two" } } })).toBe("two");
  });

  it("uses the protected viewer for unauthenticated calls despite forged prefixes", async () => {
    for (const prefix of ["", "192.0.2.5, ", "192.0.2.6, 192.0.2.7, "]) {
      expect(
        await guard.track({
          headers: {
            "x-forwarded-for": `${prefix}198.51.100.1, 203.0.113.2`,
            "cloudfront-viewer-address": "192.0.2.9:123",
          },
        }),
      ).toBe("198.51.100.1");
    }
    expect(await guard.track({ headers: { "x-forwarded-for": "198.51.100.2, 203.0.113.2" } })).toBe(
      "198.51.100.2",
    );
  });

  it("refuses missing or malformed protected suffixes", () => {
    for (const value of ["", "198.51.100.1", "198.51.100.1, ,203.0.113.2"]) {
      expect(() => guard.track({ headers: { "x-forwarded-for": value } })).toThrow(
        BadRequestException,
      );
    }
  });
});
