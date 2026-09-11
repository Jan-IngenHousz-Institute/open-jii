import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCreateUserProfile } from "./useCreateUserProfile";

describe("useCreateUserProfile", () => {
  it("invalidates global search because member names are searchable", async () => {
    server.mount(contract.users.createUserProfile, { body: {} });
    const queryClient = createTestQueryClient();
    const globalSearchKey = orpc.search.globalSearch.queryKey({
      input: { query: "ada", limit: 20 },
    });
    queryClient.setQueryData(globalSearchKey, { results: [] });

    const { result } = renderHook(() => useCreateUserProfile({}), { queryClient });
    await result.current.mutateAsync({
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(globalSearchKey)?.isInvalidated).toBe(true);
    });
  });
});
