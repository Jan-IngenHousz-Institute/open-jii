import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { MEMBER_ROWS_PAGE_SIZE, listAllMemberRows } from "./useOrganizationMemberRows";

type ListMembers = typeof authClient.organization.listMembers;
type ListMembersArgs = Parameters<ListMembers>[0];

const listMembers = vi.mocked(authClient.organization.listMembers);

function rows(from: number, to: number) {
  return Array.from({ length: to - from }, (_, index) => ({
    id: `member-${from + index}`,
    userId: `user-${from + index}`,
    organizationId: "org-1",
    role: "member",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
  }));
}

function serveRoster(total: number) {
  listMembers.mockImplementation(((args: ListMembersArgs) => {
    const offset = Number(args?.query?.offset ?? 0);
    const limit = Number(args?.query?.limit ?? 100);
    return Promise.resolve({
      data: { members: rows(offset, Math.min(total, offset + limit)), total },
      error: null,
    });
  }) as never);
}

describe("listAllMemberRows", () => {
  beforeEach(() => {
    listMembers.mockReset();
  });

  it("reads past Better Auth's first hundred rows so a Demo roster can be managed in full", async () => {
    serveRoster(250);

    const result = await listAllMemberRows("org-1");

    expect(result.members).toHaveLength(250);
    expect(result.total).toBe(250);
    // The member the first page would have lost has a row id to change a role by.
    expect(result.members.find((member) => member.userId === "user-249")?.id).toBe("member-249");
    expect(listMembers.mock.calls.map(([args]) => args?.query?.offset)).toEqual([0, 100, 200]);
    for (const [args] of listMembers.mock.calls) {
      expect(args?.query).toMatchObject({
        organizationId: "org-1",
        limit: MEMBER_ROWS_PAGE_SIZE,
        // Unique and stable, so offsets neither repeat nor skip rows that share a createdAt.
        sortBy: "id",
        sortDirection: "asc",
      });
    }
  });

  it("asks once for a roster that fits one page", async () => {
    serveRoster(3);
    expect((await listAllMemberRows("org-1")).members).toHaveLength(3);
    expect(listMembers).toHaveBeenCalledTimes(1);
  });

  it("stops on an exact multiple of the page size without an empty extra read", async () => {
    serveRoster(200);
    expect((await listAllMemberRows("org-1")).members).toHaveLength(200);
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it("rejects with the server's refusal instead of returning a partial roster", async () => {
    listMembers.mockResolvedValueOnce({
      data: null,
      error: { message: "Not a member", code: "FORBIDDEN" },
    });
    await expect(listAllMemberRows("org-1")).rejects.toThrow("Not a member");
  });
});
