import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useGlobalSearch } from "./useGlobalSearch";

function mockSession(userId: string | undefined) {
  vi.mocked(useSession).mockReturnValue({
    data: userId ? { user: { id: userId } } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe("useGlobalSearch", () => {
  afterEach(() => mockSession(undefined));

  it("scopes cached results to the signed-in principal", async () => {
    mockSession("user-a");
    server.mount(contract.search.globalSearch, { body: { results: [] } });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useGlobalSearch("photosynthesis"), { queryClient });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [query] = queryClient.getQueryCache().findAll({
      queryKey: orpc.search.globalSearch.key(),
    });
    expect(query.queryKey.at(-1)).toEqual({ principal: "user-a" });
    expect(query.meta).toEqual({ principal: "user-a" });
  });

  it("does not retain one principal's results while another principal loads", async () => {
    mockSession("user-a");
    server.mount(contract.search.globalSearch, {
      body: {
        results: [
          {
            type: "organization",
            id: "org-private",
            title: "Private Lab",
            subtitle: null,
            meta: "research_institute",
          },
        ],
      },
    });
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(() => useGlobalSearch("photosynthesis"), {
      queryClient,
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    let release!: () => void;
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.mount(contract.search.globalSearch, { body: { results: [] }, unblock });
    mockSession("user-b");
    rerender();

    expect(result.current.results).toEqual([]);
    release();
    await waitFor(() => expect(result.current.isFetching).toBe(false));
  });
});
