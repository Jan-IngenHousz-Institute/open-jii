/**
 * useTransferRequestCreate hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.createTransferRequest.useMutation` →
 * `POST /api/v1/experiments/transfer-requests`. MSW intercepts that request.
 */
import { createTransferRequest } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useTransferRequestCreate } from "./useTransferRequestCreate";

describe("useTransferRequestCreate", () => {
  it("sends POST request via MSW", async () => {
    const spy = server.mount(contract.experiments.createTransferRequest, {
      body: createTransferRequest({ requestId: "req-1" }),
    });

    const { result } = renderHook(() => useTransferRequestCreate());

    act(() => {
      result.current.mutate({
        body: {
          projectIdOld: "old-123",
          projectUrlOld: "https://photosynq.com/projects/old-123",
        },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
  });

  it("sends correct body", async () => {
    const spy = server.mount(contract.experiments.createTransferRequest, {
      body: createTransferRequest({ requestId: "req-2" }),
    });

    const { result } = renderHook(() => useTransferRequestCreate());

    act(() => {
      result.current.mutate({
        body: {
          projectIdOld: "old-456",
          projectUrlOld: "https://photosynq.com/projects/old-456",
        },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({
        projectIdOld: "old-456",
        projectUrlOld: "https://photosynq.com/projects/old-456",
      });
    });
  });

  it("calls onSuccess callback with requestId", async () => {
    server.mount(contract.experiments.createTransferRequest, {
      body: createTransferRequest({ requestId: "req-99" }),
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTransferRequestCreate({ onSuccess }));

    act(() => {
      result.current.mutate({
        body: {
          projectIdOld: "old-123",
          projectUrlOld: "https://photosynq.com/projects/old-123",
        },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("req-99");
    });
  });

  it("calls onError callback on failure", async () => {
    server.mount(contract.experiments.createTransferRequest, { status: 500 });

    const onError = vi.fn();
    const { result } = renderHook(() => useTransferRequestCreate({ onError }));

    act(() => {
      result.current.mutate({
        body: {
          projectIdOld: "old-123",
          projectUrlOld: "https://photosynq.com/projects/old-123",
        },
      });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.createTransferRequest, { status: 500 });

    const { result } = renderHook(() => useTransferRequestCreate());

    act(() => {
      result.current.mutate({
        body: {
          projectIdOld: "old-123",
          projectUrlOld: "https://photosynq.com/projects/old-123",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
