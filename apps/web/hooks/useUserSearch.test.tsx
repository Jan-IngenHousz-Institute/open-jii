import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useUserSearch } from "./useUserSearch";

function mockPrincipal(id: string) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id } },
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe("useUserSearch", () => {
  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("sends no empty or one-character request and sends a trimmed two-character term", async () => {
    mockPrincipal("actor-a");
    const spy = server.mount(contract.users.searchUsers, { body: [] });
    const { rerender } = renderHook(({ term }: { term: string }) => useUserSearch(term), {
      initialProps: { term: "" },
    });

    rerender({ term: "C" });
    rerender({ term: " C " });
    expect(spy.callCount).toBe(0);

    rerender({ term: " Co " });
    await waitFor(() => expect(spy.callCount).toBe(1));
    expect(spy.calls[0]?.query.query).toBe("Co");
  });

  it("does not show an owner's cached address to a plain member in the same QueryClient", async () => {
    const queryClient = createTestQueryClient();
    const visible = createUserProfile({
      userId: "c",
      firstName: "Cora",
      lastName: "Admin",
      email: "cora@example.test",
    });
    server.mount(contract.users.searchUsers, { body: [visible] });
    mockPrincipal("actor-a");
    const { result, rerender } = renderHook(() => useUserSearch("Cora"), { queryClient });
    await waitFor(() => expect(result.current.data?.[0]?.email).toBe("cora@example.test"));

    server.mount(contract.users.searchUsers, { body: [{ ...visible, email: null }] });
    mockPrincipal("actor-b");
    rerender();
    expect(result.current.data?.[0]?.email).not.toBe("cora@example.test");
    await waitFor(() => expect(result.current.data?.[0]?.email).toBeNull());
    expect(result.current.data?.[0]?.firstName).toBe("Cora");
  });
});
