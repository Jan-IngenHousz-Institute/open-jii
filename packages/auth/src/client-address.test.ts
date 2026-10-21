import { describe, expect, it, vi } from "vitest";

import { resolveClientAddress } from "./client-address";
import { withClientAddress } from "./client-address-handler";

describe("protected client address", () => {
  it.each([
    ["198.51.100.10, 203.0.113.20", "198.51.100.10"],
    ["forged, , 198.51.100.10, 203.0.113.20", "198.51.100.10"],
    ["2001:0DB8:0000:0:0:0:0:1, 2001:db8::2", "2001:db8::1"],
    ["::ffff:192.0.2.1, 203.0.113.20", "192.0.2.1"],
    ["::ffff:c000:201, 203.0.113.20", "192.0.2.1"],
    ["", null],
    ["198.51.100.10", null],
    ["198.51.100.10, , 203.0.113.20", null],
    ["198.51.100.10, 203.0.113.20,", null],
    ["198.51.100.10:123, 203.0.113.20", null],
    ["[2001:db8::1]:123, 203.0.113.20", null],
    ["fe80::1%eth0, 203.0.113.20", null],
    ["198.51.100.10, invalid", null],
  ])("resolves %s as %s", (xff, expected) => {
    expect(
      resolveClientAddress({ headers: new Headers({ "x-forwarded-for": xff }) }, "cloudfront-alb"),
    ).toBe(expected);
  });

  it.each([undefined, "", "invalid", "cloudfront-alb", "LOCAL"])(
    "defaults %s to protected mode regardless of NODE_ENV",
    (mode) => {
      for (const environment of ["test", "development", "production"]) {
        vi.stubEnv("NODE_ENV", environment);
        vi.stubEnv("AUTH_CLIENT_ADDRESS_MODE", mode);
        expect(resolveClientAddress({})).toBeNull();
      }
      vi.unstubAllEnvs();
    },
  );

  it("uses the socket or localhost only in explicit local mode", () => {
    const headers = { "x-forwarded-for": "198.51.100.10, 203.0.113.20" };
    expect(resolveClientAddress({ headers }, "local")).toBe("127.0.0.1");
    expect(
      resolveClientAddress({ headers, socket: { remoteAddress: "::ffff:127.0.0.2" } }, "local"),
    ).toBe("127.0.0.2");
  });

  it("does not collapse separate IPv6 hosts into a shared subnet", () => {
    expect(
      resolveClientAddress(
        { headers: { "x-forwarded-for": "2001:db8::1, 203.0.113.20" } },
        "cloudfront-alb",
      ),
    ).not.toBe(
      resolveClientAddress(
        { headers: { "x-forwarded-for": "2001:db8::2, 203.0.113.20" } },
        "cloudfront-alb",
      ),
    );
  });

  it("stamps the trusted suffix before the handler and ignores alternative headers", async () => {
    vi.stubEnv("AUTH_CLIENT_ADDRESS_MODE", "cloudfront-alb");
    const handler = vi.fn((request: Request) =>
      Promise.resolve(
        Response.json({ address: request.headers.get("x-openjii-resolved-client-address") }),
      ),
    );
    const response = await withClientAddress(handler)(
      new Request("https://example.test", {
        headers: {
          "x-forwarded-for": "198.51.100.99, 198.51.100.10, 203.0.113.20",
          "cloudfront-viewer-address": "198.51.100.99:5000",
          "x-real-ip": "198.51.100.99",
          forwarded: "for=198.51.100.99",
          "x-openjii-resolved-client-address": "198.51.100.99",
        },
      }),
    );
    expect(await response.json()).toEqual({ address: "198.51.100.10" });
    vi.unstubAllEnvs();
  });
});
