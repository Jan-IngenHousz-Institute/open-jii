import { describe, expect, it } from "vitest";

import { withoutOtherUsersEmails } from "./member-emails";

const me = { id: "me", name: "Me", email: "me@example.com", image: null };
const them = { id: "them", name: "Them", email: "them@example.com", image: null };

describe("withoutOtherUsersEmails", () => {
  it("withholds other members' addresses and keeps the caller's own", () => {
    const returned = {
      members: [
        { id: "m1", userId: "me", user: me },
        { id: "m2", userId: "them", user: them },
      ],
      total: 2,
    };

    expect(withoutOtherUsersEmails(returned, "me")).toEqual({
      members: [
        { id: "m1", userId: "me", user: me },
        { id: "m2", userId: "them", user: { ...them, email: null } },
      ],
      total: 2,
    });
  });

  it("withholds every member's address from a caller with no session", () => {
    expect(withoutOtherUsersEmails([{ user: me }], null)).toEqual([
      { user: { ...me, email: null } },
    ]);
  });

  it("withholds the inviter's address unless the caller is the inviter", () => {
    const invitation = { id: "i1", email: "invitee@example.com", inviterId: "them" };

    expect(
      withoutOtherUsersEmails({ ...invitation, inviterEmail: "them@example.com" }, "me"),
    ).toEqual({ ...invitation, inviterEmail: null });
    expect(
      withoutOtherUsersEmails({ ...invitation, inviterEmail: "them@example.com" }, "them"),
    ).toEqual({ ...invitation, inviterEmail: "them@example.com" });
  });

  it("leaves an invitation's own invitee address alone", () => {
    const invitations = [{ id: "i1", email: "invitee@example.com", inviterId: "them" }];

    expect(withoutOtherUsersEmails(invitations, "me")).toEqual(invitations);
  });

  it("passes through values that are not plain JSON", () => {
    const createdAt = new Date("2026-10-12T00:00:00Z");
    const error = new Error("refused");

    expect(withoutOtherUsersEmails({ createdAt }, "me")).toEqual({ createdAt });
    expect(withoutOtherUsersEmails(error, "me")).toBe(error);
    expect(withoutOtherUsersEmails(null, "me")).toBeNull();
  });
});
