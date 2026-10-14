import { renderHook, createTestQueryClient } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";

import { useUpdateUser } from "./useUpdateUser";

describe("useUpdateUser", () => {
  it("calls updateUser, invalidates auth queries and revalidates the auth routes", async () => {
    vi.mocked(authClient.updateUser).mockResolvedValue({ data: { success: true }, error: null });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateUser(), { queryClient });
    await result.current.mutateAsync({ name: "New Name" });

    expect(authClient.updateUser).toHaveBeenCalledWith({ name: "New Name" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth"] });
    expect(revalidateAuth).toHaveBeenCalled();
  });
});
