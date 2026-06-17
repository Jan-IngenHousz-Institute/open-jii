import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useDeleteUser } from "./useDeleteUser";

const USER_ID = "00000000-0000-4000-8000-000000000000";

describe("useDeleteUser", () => {
  it("runs the caller's onSuccess when the account is deleted", async () => {
    const onSuccess = vi.fn();
    server.mount(contract.users.deleteUser, { status: 204 });

    const { result } = renderHook(() => useDeleteUser({ onSuccess }));

    act(() => {
      result.current.mutate({ params: { id: USER_ID } });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("surfaces the API error as a destructive toast and forwards the contract error to onError", async () => {
    const onError = vi.fn();
    server.mount(contract.users.deleteUser, {
      status: 403,
      body: { message: "Not allowed to delete" },
    });

    const { result } = renderHook(() => useDeleteUser({ onError }));

    act(() => {
      result.current.mutate({ params: { id: USER_ID } });
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "Not allowed to delete",
        variant: "destructive",
      });
    });
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toMatchObject({ status: 403 });
  });
});
