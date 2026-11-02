import { createUserProfile } from "@/test/factories";
import { renderHook } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@repo/auth/client";

import type { PickerRow } from "./picking-rule";
import { describeSearchedUser, emailInviteFor, usePickerRows } from "./picking-rule";

const t = (key: string) => key;

function userRow(id: string, unavailableReason: string | null = null): PickerRow<string> {
  return {
    key: id,
    kind: "user",
    label: id,
    person: { id },
    badges: [],
    unavailableReason,
    value: id,
  };
}

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function rowsFor(ids: string[], describe: (id: string) => PickerRow<string> = (id) => userRow(id)) {
  return renderHook(() => usePickerRows(ids, describe)).result.current;
}

describe("usePickerRows", () => {
  afterEach(() => mockSession(null));

  it("drops the viewer and keeps everyone else in the search's order", () => {
    mockSession({ id: "viewer" });

    expect(rowsFor(["b", "viewer", "a", "c"]).map((row) => row.key)).toEqual(["b", "a", "c"]);
  });

  it("keeps an unpickable row where relevance put it, with its reason", () => {
    const rows = rowsFor(["exact", "other"], (id) =>
      userRow(id, id === "exact" ? "Already added" : null),
    );

    expect(rows.map((row) => [row.key, row.unavailableReason])).toEqual([
      ["exact", "Already added"],
      ["other", null],
    ]);
  });

  it("drops nobody before the session is known", () => {
    expect(rowsFor(["a"])).toHaveLength(1);
  });

  it("never drops a team or organization whose id happens to match the viewer's", () => {
    mockSession({ id: "viewer" });

    expect(
      rowsFor(["viewer"], (id) => ({ ...userRow(id), kind: "team", person: null })),
    ).toHaveLength(1);
  });
});

describe("describeSearchedUser", () => {
  it("is pickable and unbadged unless given a reason", () => {
    const user = createUserProfile({ userId: "u-1", firstName: "Lin", lastName: "Zhao" });
    const row = describeSearchedUser(user, { typedEmail: null, t });

    expect(row).toMatchObject({
      key: "u-1",
      label: "Lin Zhao",
      badges: [],
      unavailableReason: null,
    });
    expect(row.value).toBe(user);
    expect(
      describeSearchedUser(user, { typedEmail: null, t, reason: "No" }).unavailableReason,
    ).toBe("No");
  });

  it("shows the email when the server returned it", () => {
    const user = createUserProfile({ email: "lin@uni.edu", matchedEmail: true });

    expect(
      describeSearchedUser(user, { typedEmail: "lin@uni.edu", t }).identityLine,
    ).toBeUndefined();
  });

  it("gives the match hint only for a hidden address typed in full", () => {
    const matched = createUserProfile({ email: null, matchedEmail: true });
    const unmatched = createUserProfile({ email: null, matchedEmail: false });

    expect(describeSearchedUser(matched, { typedEmail: "lin@uni.edu", t }).identityLine).toBe(
      "common.emailMatched",
    );
    expect(describeSearchedUser(matched, { typedEmail: null, t }).identityLine).toBeNull();
    expect(
      describeSearchedUser(unmatched, { typedEmail: "lin@uni.edu", t }).identityLine,
    ).toBeNull();
  });
});

describe("emailInviteFor", () => {
  const base = {
    allowed: true,
    typed: "new@uni.edu",
    settled: true,
    isError: false,
    candidates: [],
    invitedEmails: [],
  };

  it("offers an address no account answers to", () => {
    expect(emailInviteFor(base)).toEqual({ offer: true, reason: "noMatch" });
  });

  it("offers nothing for a term that is not a complete address", () => {
    expect(emailInviteFor({ ...base, typed: "new@uni" })).toEqual({
      offer: false,
      reason: "noMatch",
    });
  });

  it("offers nothing where the context does not allow invitations", () => {
    expect(emailInviteFor({ ...base, allowed: false }).offer).toBe(false);
  });

  it("offers nothing after a failed search, which cannot rule out an account", () => {
    expect(emailInviteFor({ ...base, isError: true }).offer).toBe(false);
  });

  it("treats an address an account answers to as registered", () => {
    expect(emailInviteFor({ ...base, candidates: [{ email: null, matchedEmail: true }] })).toEqual({
      offer: false,
      reason: "registered",
    });
    expect(
      emailInviteFor({ ...base, candidates: [{ email: "NEW@uni.edu", matchedEmail: false }] }),
    ).toEqual({ offer: false, reason: "registered" });
  });

  it("does not trust an answer for a different term", () => {
    expect(
      emailInviteFor({
        ...base,
        settled: false,
        candidates: [{ email: null, matchedEmail: true }],
      }).reason,
    ).toBe("noMatch");
  });

  it("refuses an address already invited or already a member, ignoring case", () => {
    expect(emailInviteFor({ ...base, invitedEmails: ["New@Uni.edu"] })).toEqual({
      offer: false,
      reason: "invited",
    });
    expect(emailInviteFor({ ...base, memberEmails: ["NEW@uni.edu"] })).toEqual({
      offer: false,
      reason: "member",
    });
  });
});
