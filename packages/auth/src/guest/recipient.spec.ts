import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Database from "@repo/database";

import { isGuestRecipient } from "./recipient";

const { select, rows } = vi.hoisted(() => ({ select: vi.fn(), rows: [] as { id: string }[] }));
vi.mock("@repo/database", async (original) => ({
  ...(await original<typeof Database>()),
  db: {
    select: (...args: unknown[]) => {
      select(...args);
      return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) };
    },
  },
}));

describe("guest email recipients", () => {
  beforeEach(() => {
    rows.length = 0;
    select.mockClear();
  });
  it("refuses the reserved domain without a lookup", async () => {
    expect(await isGuestRecipient("  Synthetic@GUEST.OPENJII.INVALID ")).toBe(true);
    expect(select).not.toHaveBeenCalled();
  });
  it("refuses an authoritative guest even at a legacy real address", async () => {
    rows.push({ id: "guest" });
    expect(await isGuestRecipient("synthetic@example.test")).toBe(true);
  });
  it("permits ordinary and unregistered recipients", async () => {
    expect(await isGuestRecipient("synthetic@example.test")).toBe(false);
  });
});
