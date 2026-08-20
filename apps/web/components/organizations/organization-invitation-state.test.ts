import { describe, expect, it } from "vitest";

import { isLiveInvitation, liveInvitations } from "./organization-invitation-state";

const NOW = Date.parse("2026-08-10T12:00:00.000Z");
const future = new Date(NOW + 60 * 60 * 1000).toISOString();
const past = new Date(NOW - 60 * 60 * 1000).toISOString();

describe("isLiveInvitation", () => {
  it("accepts a pending invitation that has not expired", () => {
    expect(isLiveInvitation({ status: "pending", expiresAt: future }, NOW)).toBe(true);
  });

  /**
   * The whole reason this helper exists: Better Auth refuses an expired invitation
   * but never retires its stored `pending` status, so status alone would keep a
   * past-due row on the Invited tab — and its address in the "already invited" set —
   * until somebody cancelled it by hand.
   */
  it("rejects a pending invitation that has expired", () => {
    expect(isLiveInvitation({ status: "pending", expiresAt: past }, NOW)).toBe(false);
  });

  it("treats the expiry moment itself as expired", () => {
    expect(
      isLiveInvitation({ status: "pending", expiresAt: new Date(NOW).toISOString() }, NOW),
    ).toBe(false);
  });

  it.each(["accepted", "rejected", "canceled"])("rejects a %s invitation", (status) => {
    expect(isLiveInvitation({ status, expiresAt: future }, NOW)).toBe(false);
  });

  it("accepts a Date expiry as well as a string one", () => {
    expect(isLiveInvitation({ status: "pending", expiresAt: new Date(future) }, NOW)).toBe(true);
  });

  it("does not drop a row whose expiry cannot be read", () => {
    // Hiding it would conceal an invitation that may well still be live, and the
    // server decides either way.
    expect(isLiveInvitation({ status: "pending", expiresAt: "not-a-date" }, NOW)).toBe(true);
  });
});

describe("liveInvitations", () => {
  it("keeps the live rows in the order they came back", () => {
    const rows = [
      { id: "a", status: "pending", expiresAt: future },
      { id: "b", status: "pending", expiresAt: past },
      { id: "c", status: "accepted", expiresAt: future },
      { id: "d", status: "pending", expiresAt: future },
    ];

    expect(liveInvitations(rows, NOW).map((row) => row.id)).toEqual(["a", "d"]);
  });

  it("treats a missing list as empty", () => {
    expect(liveInvitations(undefined)).toEqual([]);
    expect(liveInvitations(null)).toEqual([]);
  });
});
