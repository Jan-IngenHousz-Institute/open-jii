import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useRevokeIotCredentials } from "./useRevokeIotCredentials";

describe("useRevokeIotCredentials", () => {
  it("revokes and calls onSuccess", async () => {
    server.mount(contract.iot.revokeIotCredentials, {
      status: 200,
      body: createIotDevice({ status: "revoked" }),
    });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRevokeIotCredentials({ onSuccess }));

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" } });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("surfaces an error", async () => {
    server.mount(contract.iot.revokeIotCredentials, { status: 400 });
    const { result } = renderHook(() => useRevokeIotCredentials());

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
