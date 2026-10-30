import { describe, expect, it } from "vitest";

import { guestNativeRouteInventory, guestRouteInventory, matchGuestRoute } from "./guest-routes";

describe("guest route matching", () => {
  it("matches every documented route, including decoded parameters and trailing slashes", () => {
    for (const route of [...guestRouteInventory, ...guestNativeRouteInventory]) {
      const path = route.path.replace(/\{[^}]+\}/g, "demo%20id");
      const match = matchGuestRoute(route.method, `${path}/`);
      expect(match?.route).toEqual(route);
      for (const value of Object.values(match?.params ?? {})) expect(value).toBe("demo id");
    }
  });

  it("prefers a static route to a parameter and refuses malformed or unknown routes", () => {
    expect(
      matchGuestRoute("DELETE", "/api/v1/experiments/demo/collaborators/me")?.route.procedure,
    ).toBe("sharing.leaveResource");
    expect(matchGuestRoute("NOT-A-METHOD", "/experiments")).toBeNull();
    expect(matchGuestRoute("GET", "/missing/path/with/many/segments/here")).toBeNull();
    expect(matchGuestRoute("GET", "/api/v1/experiments/%ZZ/collaborators")).toBeNull();
  });
});
