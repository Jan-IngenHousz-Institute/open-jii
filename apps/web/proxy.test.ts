import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

describe("locale proxy", () => {
  it.each(["/opengraph-image", "/opengraph-image/", "/twitter-image", "/twitter-image/"])(
    "does not localize the root metadata image route %s",
    (pathname) => {
      const response = proxy(new NextRequest(`https://openjii.org${pathname}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("still redirects ordinary unlocalized routes to the default locale", () => {
    const response = proxy(new NextRequest("https://openjii.org/about?source=e2e"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://openjii.org/en-US/about?source=e2e");
  });
});
