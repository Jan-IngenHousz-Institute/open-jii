import { createOrganizationDirectoryEntry } from "@/test/factories";
import { arrayParam, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useOrganizationsList } from "./useOrganizationsList";

function mockSession(user: { id: string } | null, isPending = false) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending,
  } as ReturnType<typeof useSession>);
}

const sort = encodeURIComponent(JSON.stringify([{ field: "type", direction: "asc" }]));

describe("useOrganizationsList", () => {
  beforeEach(() => {
    mockSession({ id: "user-1" });
    openOnUrl("/platform/organizations", "");
  });
  afterEach(() => mockSession(null));

  it("maps each row's type, including none, and membership", async () => {
    server.mount(contract.organizations.listOrganizations, {
      body: {
        organizations: [
          createOrganizationDirectoryEntry({
            id: "typed",
            type: "non_profit",
            membershipStatus: "member",
          }),
          createOrganizationDirectoryEntry({
            id: "untyped",
            type: null,
            membershipStatus: "pending_request",
          }),
        ],
      },
    });

    const { result } = renderHook(() => useOrganizationsList());

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(
      result.current.data?.items.map(({ id, type, isMember }) => ({ id, type, isMember })),
    ).toEqual([
      { id: "typed", type: "non_profit", isMember: true },
      { id: "untyped", type: null, isMember: false },
    ]);
  });

  it("pages the whole directory 20 rows at a time", async () => {
    server.mount(contract.organizations.listOrganizations, {
      body: {
        organizations: Array.from({ length: 25 }, (_, index) =>
          createOrganizationDirectoryEntry({ id: `org-${index}` }),
        ),
      },
    });

    const { result } = renderHook(() => useOrganizationsList());
    await waitFor(() => expect(result.current.data?.totalPages).toBe(2));
    act(() => result.current.setPage(2));

    expect(result.current.data?.items.map((row) => row.id)).toEqual([
      "org-20",
      "org-21",
      "org-22",
      "org-23",
      "org-24",
    ]);
  });

  it("sends the URL's search, types and sort, across the whole directory", async () => {
    openOnUrl("/platform/organizations", `q=lab&type=university,non_profit&sort=${sort}`);
    const spy = server.mount(contract.organizations.listOrganizations, {
      body: { organizations: [] },
    });

    const { result } = renderHook(() => useOrganizationsList());

    expect(result.current.search).toBe("lab");
    await waitFor(() => expect(spy.called).toBe(true));
    const call = spy.calls.at(-1);
    expect(call?.query.search).toBe("lab");
    expect(call?.query.scope).toBe("all");
    expect(arrayParam(call?.url ?? "", "type")).toEqual(["university", "non_profit"]);
    expect(call?.query["sort[0][field]"]).toBe("type");
  });

  it("waits for the session before asking", async () => {
    mockSession(null, true);
    const spy = server.mount(contract.organizations.listOrganizations, {
      body: { organizations: [] },
    });

    const { result } = renderHook(() => useOrganizationsList());

    expect(result.current.isLoading).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(spy.called).toBe(false);
  });
});
