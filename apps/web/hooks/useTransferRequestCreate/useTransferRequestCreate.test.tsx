import { NOTIFICATIONS_KEY } from "@/hooks/notifications/useNotifications/useNotifications";
import { createTransferRequest } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useTransferRequestCreate } from "./useTransferRequestCreate";

describe("useTransferRequestCreate", () => {
  it("sends POST request", async () => {
    const spy = server.mount(contract.experiments.createTransferRequest, {
      body: createTransferRequest({ requestId: "req-1" }),
    });

    const { result } = renderHook(() => useTransferRequestCreate());

    act(() => {
      result.current.mutate({
        projectIdOld: "old-123",
        projectUrlOld: "https://photosynq.com/projects/old-123",
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
        projectIdOld: "old-456",
        projectUrlOld: "https://photosynq.com/projects/old-456",
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
        projectIdOld: "old-123",
        projectUrlOld: "https://photosynq.com/projects/old-123",
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("req-99");
    });
  });

  it("refreshes the bell, which now holds the submitter's own notification", async () => {
    server.mount(contract.experiments.createTransferRequest, {
      body: createTransferRequest({ requestId: "req-3" }),
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useTransferRequestCreate(), { queryClient });

    act(() => {
      result.current.mutate({
        projectIdOld: "old-123",
        projectUrlOld: "https://photosynq.com/projects/old-123",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_KEY });
  });

  it("calls onError callback on failure", async () => {
    server.mount(contract.experiments.createTransferRequest, { status: 500 });

    const onError = vi.fn();
    const { result } = renderHook(() => useTransferRequestCreate({ onError }));

    act(() => {
      result.current.mutate({
        projectIdOld: "old-123",
        projectUrlOld: "https://photosynq.com/projects/old-123",
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
        projectIdOld: "old-123",
        projectUrlOld: "https://photosynq.com/projects/old-123",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
