import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useRotateIotCredentials } from "./useRotateIotCredentials";

const CERT = {
  certificateId: "c2",
  certificateArn: "arn:c2",
  certificatePem: "PEM2",
  publicKey: "PUB2",
  privateKey: "KEY2",
};

describe("useRotateIotCredentials", () => {
  it("rotates and calls onSuccess with the new bundle", async () => {
    server.mount(contract.iot.rotateIotCredentials, { status: 201, body: CERT });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRotateIotCredentials({ onSuccess }));

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" }, body: {} });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(CERT);
    });
  });

  it("surfaces an error", async () => {
    server.mount(contract.iot.rotateIotCredentials, { status: 400 });
    const { result } = renderHook(() => useRotateIotCredentials());

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" }, body: {} });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
