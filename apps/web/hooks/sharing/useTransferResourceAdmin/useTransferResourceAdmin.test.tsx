import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useTransferResourceAdmin } from "./useTransferResourceAdmin";

const MACRO_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TARGET_USER_ID = "11111111-1111-4111-8111-111111111111";

const transferBody = {
  transfers: [
    { resourceType: "macro" as const, resourceId: MACRO_ID, targetUserId: TARGET_USER_ID },
  ],
};

describe("useTransferResourceAdmin", () => {
  it("shows a success toast and runs the caller's onSuccess when all transfers succeed", async () => {
    const onSuccess = vi.fn();
    server.mount(contract.sharing.transferResourceAdmin, {
      status: 200,
      body: { results: [{ resourceType: "macro", resourceId: MACRO_ID, success: true }] },
    });

    const { result } = renderHook(() => useTransferResourceAdmin({ onSuccess }));

    act(() => {
      result.current.mutate(transferBody);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "dangerZone.delete.blockers.transferSuccess",
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows a destructive partial toast when some transfers fail", async () => {
    server.mount(contract.sharing.transferResourceAdmin, {
      status: 200,
      body: {
        results: [{ resourceType: "macro", resourceId: MACRO_ID, success: false, error: "boom" }],
      },
    });

    const { result } = renderHook(() => useTransferResourceAdmin());

    act(() => {
      result.current.mutate(transferBody);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "dangerZone.delete.blockers.transferPartial",
        variant: "destructive",
      });
    });
  });

  it("surfaces the API error message and forwards the contract error to onError", async () => {
    const onError = vi.fn();
    server.mount(contract.sharing.transferResourceAdmin, {
      status: 403,
      body: { message: "Not allowed to transfer" },
    });

    const { result } = renderHook(() => useTransferResourceAdmin({ onError }));

    act(() => {
      result.current.mutate(transferBody);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "Not allowed to transfer",
        variant: "destructive",
      });
    });
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
    expect(onError.mock.calls[0][0]).toMatchObject({ status: 403 });
  });

  it("falls back to the generic error toast when the response has no message", async () => {
    server.mount(contract.sharing.transferResourceAdmin, {
      status: 500,
      // No `message` field, so parseApiError yields undefined and the hook
      // uses its translated fallback.
      body: { unexpected: true },
    });

    const { result } = renderHook(() => useTransferResourceAdmin());

    act(() => {
      result.current.mutate(transferBody);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "dangerZone.delete.blockers.transferError",
        variant: "destructive",
      });
    });
  });
});
