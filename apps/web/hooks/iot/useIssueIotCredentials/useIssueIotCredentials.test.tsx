import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useIssueIotCredentials } from "./useIssueIotCredentials";

const CERT = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

describe("useIssueIotCredentials", () => {
  it("issues and calls onSuccess with the credential bundle", async () => {
    server.mount(contract.iot.issueIotCredentials, { status: 201, body: CERT });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useIssueIotCredentials({ onSuccess }));

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" }, body: {} });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(CERT);
    });
  });

  it("surfaces an error", async () => {
    server.mount(contract.iot.issueIotCredentials, { status: 400 });
    const { result } = renderHook(() => useIssueIotCredentials());

    act(() => {
      result.current.mutate({ params: { deviceId: "d1" }, body: {} });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
