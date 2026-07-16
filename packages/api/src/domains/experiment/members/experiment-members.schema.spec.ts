import { describe, expect, it } from "vitest";

import {
  zAddExperimentMembersBody,
  zExperimentMember,
  zExperimentMemberList,
  zExperimentMemberPathParam,
  zTransferExperimentAdminBody,
  zTransferExperimentAdminResponse,
  zTransferExperimentAdminResult,
  zUpdateExperimentMemberRoleBody,
} from "./experiment-members.schema";

const member = {
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    avatarUrl: null,
  },
  role: "admin" as const,
  joinedAt: "2024-01-01T00:00:00.000Z",
};

describe("zExperimentMember", () => {
  it("accepts a valid member", () => {
    expect(zExperimentMember.parse(member)).toEqual(member);
  });

  it("accepts an optional experimentId", () => {
    const withExp = { ...member, experimentId: "22222222-2222-2222-2222-222222222222" };
    expect(zExperimentMember.parse(withExp)).toEqual(withExp);
  });

  it("allows a null email", () => {
    const nulled = { ...member, user: { ...member.user, email: null } };
    expect(zExperimentMember.parse(nulled)).toEqual(nulled);
  });

  it("rejects a malformed email", () => {
    const bad = { ...member, user: { ...member.user, email: "not-an-email" } };
    expect(() => zExperimentMember.parse(bad)).toThrow();
  });

  it("rejects an unknown role", () => {
    expect(() => zExperimentMember.parse({ ...member, role: "owner" })).toThrow();
  });
});

describe("zExperimentMemberList", () => {
  it("accepts an array of members", () => {
    expect(zExperimentMemberList.parse([member])).toEqual([member]);
  });
});

describe("zAddExperimentMembersBody", () => {
  it("defaults an omitted role to member", () => {
    const parsed = zAddExperimentMembersBody.parse({
      members: [{ userId: "33333333-3333-3333-3333-333333333333" }],
    });
    expect(parsed.members[0].role).toBe("member");
  });

  it("keeps an explicit role", () => {
    const parsed = zAddExperimentMembersBody.parse({
      members: [{ userId: "33333333-3333-3333-3333-333333333333", role: "admin" }],
    });
    expect(parsed.members[0].role).toBe("admin");
  });

  it("rejects a non-uuid userId", () => {
    expect(() => zAddExperimentMembersBody.parse({ members: [{ userId: "x" }] })).toThrow();
  });
});

describe("zUpdateExperimentMemberRoleBody", () => {
  it("accepts a valid role", () => {
    expect(zUpdateExperimentMemberRoleBody.parse({ role: "member" })).toEqual({ role: "member" });
  });

  it("rejects an invalid role", () => {
    expect(() => zUpdateExperimentMemberRoleBody.parse({ role: "guest" })).toThrow();
  });
});

describe("zTransferExperimentAdminBody", () => {
  const transfer = {
    experimentId: "44444444-4444-4444-4444-444444444444",
    targetUserId: "55555555-5555-5555-5555-555555555555",
  };

  it("accepts at least one transfer", () => {
    expect(zTransferExperimentAdminBody.parse({ transfers: [transfer] })).toEqual({
      transfers: [transfer],
    });
  });

  it("rejects an empty transfers array", () => {
    expect(() => zTransferExperimentAdminBody.parse({ transfers: [] })).toThrow();
  });

  it("rejects non-uuid ids", () => {
    expect(() =>
      zTransferExperimentAdminBody.parse({ transfers: [{ experimentId: "x", targetUserId: "y" }] }),
    ).toThrow();
  });
});

describe("zTransferExperimentAdminResult / Response", () => {
  it("accepts a success result and an error result", () => {
    const results = [
      { experimentId: "44444444-4444-4444-4444-444444444444", success: true },
      { experimentId: "44444444-4444-4444-4444-444444444445", success: false, error: "nope" },
    ];
    results.forEach((r) => expect(zTransferExperimentAdminResult.parse(r)).toEqual(r));
    expect(zTransferExperimentAdminResponse.parse({ results })).toEqual({ results });
  });
});

describe("zExperimentMemberPathParam", () => {
  it("accepts valid experiment + member ids", () => {
    const ok = {
      id: "66666666-6666-6666-6666-666666666666",
      memberId: "77777777-7777-7777-7777-777777777777",
    };
    expect(zExperimentMemberPathParam.parse(ok)).toEqual(ok);
  });

  it("rejects a non-uuid memberId", () => {
    expect(() =>
      zExperimentMemberPathParam.parse({
        id: "66666666-6666-6666-6666-666666666666",
        memberId: "x",
      }),
    ).toThrow();
  });
});
