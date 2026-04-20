import { renderHook, createTestQueryClient } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignOut } from "./useSignOut";

describe("useSignOut", () => {
  it("signs out and clears session cache", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["auth", "session"], { user: { id: "1" } });

    const { result } = renderHook(() => useSignOut(), { queryClient });
    await result.current.mutateAsync();

    expect(authClient.signOut).toHaveBeenCalled();
    expect(queryClient.getQueryData(["auth", "session"])).toBeNull();
  });
});
