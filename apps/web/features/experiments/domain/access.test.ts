import { describe, expect, it } from "vitest";

import type { ExperimentMember, UpdateExperimentBody } from "@repo/api/schemas/experiment.schema";

import {
  canApproveJoinRequest,
  canCancelJoinRequest,
  canEditExperiment,
  canManageJoinRequests,
  canManageMembers,
  canRejectJoinRequest,
  canRequestToJoinExperiment,
  canUpdateExperiment,
  countAdmins,
  findMember,
  hasArchiveAccess,
  isAdmin,
  isExperimentArchived,
  isExperimentPublic,
  isJoinRequestPending,
  isLastAdmin,
  isStatusOnlyUpdate,
} from "./access";

function member(id: string, role: "admin" | "member"): ExperimentMember {
  return {
    user: { id, firstName: "Ada", lastName: "Lovelace", email: null, avatarUrl: null },
    role,
    joinedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("isAdmin", () => {
  it("is true only for the admin role", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("member")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("findMember", () => {
  const members = [member("u1", "admin"), member("u2", "member")];

  it("finds the member by user id", () => {
    expect(findMember(members, "u2")).toBe(members[1]);
  });

  it("returns undefined for non-members and missing user ids", () => {
    expect(findMember(members, "u3")).toBeUndefined();
    expect(findMember(members, undefined)).toBeUndefined();
  });
});

describe("countAdmins / isLastAdmin", () => {
  it("counts members with the admin role, ignoring missing roles", () => {
    expect(countAdmins([{ role: "admin" }, { role: "member" }, {}, { role: "admin" }])).toBe(2);
    expect(countAdmins([])).toBe(0);
  });

  it("flags the sole admin as last admin", () => {
    expect(isLastAdmin("admin", 1)).toBe(true);
    expect(isLastAdmin("admin", 2)).toBe(false);
    expect(isLastAdmin("member", 1)).toBe(false);
  });
});

describe("experiment state", () => {
  it("isExperimentArchived only for archived status", () => {
    expect(isExperimentArchived({ status: "archived" })).toBe(true);
    expect(isExperimentArchived({ status: "active" })).toBe(false);
  });

  it("isExperimentPublic only for public visibility", () => {
    expect(isExperimentPublic({ visibility: "public" })).toBe(true);
    expect(isExperimentPublic({ visibility: "private" })).toBe(false);
  });
});

describe("hasArchiveAccess and its use-case gates", () => {
  it("requires admin on a non-archived experiment", () => {
    expect(hasArchiveAccess({ isAdmin: true, isArchived: false })).toBe(true);
    expect(hasArchiveAccess({ isAdmin: true, isArchived: true })).toBe(false);
    expect(hasArchiveAccess({ isAdmin: false, isArchived: false })).toBe(false);
  });

  it("canEditExperiment / canManageMembers / canManageJoinRequests follow the same rule", () => {
    const granted = { isAdmin: true, isArchived: false };
    const archived = { isAdmin: true, isArchived: true };
    for (const gate of [canEditExperiment, canManageMembers, canManageJoinRequests]) {
      expect(gate(granted)).toBe(true);
      expect(gate(archived)).toBe(false);
      expect(gate({ isAdmin: false, isArchived: false })).toBe(false);
    }
  });
});

describe("archived ⇒ status-only updates", () => {
  it("isStatusOnlyUpdate accepts exactly one defined field: status", () => {
    expect(isStatusOnlyUpdate({ status: "active" })).toBe(true);
    expect(isStatusOnlyUpdate({ status: "active", name: undefined })).toBe(true);
    expect(isStatusOnlyUpdate({ status: "active", name: "x" })).toBe(false);
    expect(isStatusOnlyUpdate({ name: "x" })).toBe(false);
    expect(isStatusOnlyUpdate({} as UpdateExperimentBody)).toBe(false);
  });

  it("canUpdateExperiment lets admins edit non-archived experiments freely", () => {
    expect(canUpdateExperiment({ isAdmin: true }, { status: "active" }, { name: "x" })).toBe(true);
    expect(canUpdateExperiment({ isAdmin: false }, { status: "active" }, { name: "x" })).toBe(
      false,
    );
  });

  it("canUpdateExperiment restricts archived experiments to status-only edits", () => {
    expect(
      canUpdateExperiment({ isAdmin: true }, { status: "archived" }, { status: "active" }),
    ).toBe(true);
    expect(canUpdateExperiment({ isAdmin: true }, { status: "archived" }, { name: "x" })).toBe(
      false,
    );
  });
});

describe("canRequestToJoinExperiment", () => {
  it("requires a public, non-archived experiment and no existing membership", () => {
    const open = { visibility: "public" } as const;
    expect(canRequestToJoinExperiment(open, { isArchived: false, isMember: false })).toBe(true);
    expect(canRequestToJoinExperiment(open, { isArchived: true, isMember: false })).toBe(false);
    expect(canRequestToJoinExperiment(open, { isArchived: false, isMember: true })).toBe(false);
    expect(
      canRequestToJoinExperiment({ visibility: "private" }, { isArchived: false, isMember: false }),
    ).toBe(false);
  });
});

describe("join-request lifecycle guards", () => {
  const access = { isAdmin: true, isArchived: false };

  it("isJoinRequestPending only for pending status", () => {
    expect(isJoinRequestPending({ status: "pending" })).toBe(true);
    for (const status of ["approved", "rejected", "cancelled"] as const) {
      expect(isJoinRequestPending({ status })).toBe(false);
    }
  });

  it("approve/reject require a pending request and join-request management access", () => {
    for (const gate of [canApproveJoinRequest, canRejectJoinRequest]) {
      expect(gate({ status: "pending" }, access)).toBe(true);
      expect(gate({ status: "approved" }, access)).toBe(false);
      expect(gate({ status: "pending" }, { isAdmin: true, isArchived: true })).toBe(false);
      expect(gate({ status: "pending" }, { isAdmin: false, isArchived: false })).toBe(false);
    }
  });

  it("only the requester can cancel, and only while pending", () => {
    const request = { status: "pending", user: member("u1", "member").user } as const;
    expect(canCancelJoinRequest(request, "u1")).toBe(true);
    expect(canCancelJoinRequest(request, "u2")).toBe(false);
    expect(canCancelJoinRequest(request, undefined)).toBe(false);
    expect(canCancelJoinRequest({ ...request, status: "cancelled" }, "u1")).toBe(false);
  });
});
