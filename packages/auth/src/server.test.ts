import { fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Database from "@repo/database";
import { ensurePersonalOrganization } from "@repo/database";

import { auth } from "./server";

vi.mock("@repo/database", async (original) => ({
  ...(await original<typeof Database>()),
  ensurePersonalOrganization: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("guest server wiring", () => {
  it("installs the anonymous and server-owned registration guards and throttles entry", () => {
    expect(auth.options.plugins.map((plugin) => plugin.id)).toEqual(
      expect.arrayContaining(["anonymous", "server-owned-registration"]),
    );
    expect(auth.options.rateLimit.customRules["/sign-in/anonymous"]).toEqual({
      window: 60,
      max: 10,
    });
    expect(auth.options.user.additionalFields.registered.input).toBe(false);
  });

  it("provisions a personal organization for researchers, but none for anonymous users", async () => {
    const after = auth.options.databaseHooks.user.create.after;
    const user = fromPartial<Parameters<typeof after>[0]>({
      id: "researcher",
      name: "Ada",
      isAnonymous: false,
    });
    await after(user);
    expect(ensurePersonalOrganization).toHaveBeenCalledWith(expect.anything(), {
      id: "researcher",
      name: "Ada",
    });
    vi.mocked(ensurePersonalOrganization).mockClear();
    await after({ ...user, isAnonymous: true });
    expect(ensurePersonalOrganization).not.toHaveBeenCalled();
  });

  it("reports a provisioning failure without failing sign-up", async () => {
    const after = auth.options.databaseHooks.user.create.after;
    const error = new Error("database unavailable");
    vi.mocked(ensurePersonalOrganization).mockRejectedValueOnce(error);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(
      after(fromPartial<Parameters<typeof after>[0]>({ id: "researcher", name: "Ada" })),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("Failed to provision personal organization for user:", error);
    warn.mockRestore();
  });
});
