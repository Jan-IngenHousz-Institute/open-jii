import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasPlatformRole, isPlatformAdmin } from "./platform-admin";

const { held } = vi.hoisted(() => ({ held: vi.fn() }));
vi.mock("@repo/database", () => ({ db: {}, heldPlatformRoles: held }));

beforeEach(() => {
  held.mockReset();
});

describe("platform role checks", () => {
  it.each([null, undefined, { id: "guest", isAnonymous: true }])(
    "refuses an absent or anonymous account without reading roles",
    async (user) => {
      expect(await isPlatformAdmin(user)).toBe(false);
      expect(held).not.toHaveBeenCalled();
    },
  );

  it("refuses an API key even when its owner holds a role", async () => {
    held.mockResolvedValue(["platform_admin"]);
    expect(await isPlatformAdmin({ id: "owner" }, new Headers({ "x-api-key": "key" }))).toBe(false);
    expect(held).not.toHaveBeenCalled();
  });

  it("reads each request's roles again so revocation takes effect", async () => {
    held.mockResolvedValueOnce(["platform_admin"]).mockResolvedValueOnce([]);
    expect(await isPlatformAdmin({ id: "owner" })).toBe(true);
    expect(
      await hasPlatformRole({ id: "owner", isAnonymous: false }, "platform_admin", new Headers()),
    ).toBe(false);
    expect(held).toHaveBeenCalledTimes(2);
    expect(held).toHaveBeenCalledWith({}, "owner");
  });

  it("propagates a database failure instead of treating it as permission", async () => {
    held.mockRejectedValue(new Error("unavailable"));
    await expect(isPlatformAdmin({ id: "owner" })).rejects.toThrow("unavailable");
  });
});
