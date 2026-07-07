import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { WHATS_NEW_LAST_SEEN_KEY } from "../useWhatsNewLastSeen/useWhatsNewLastSeen";
import { useMarkWhatsNewSeen } from "./useMarkWhatsNewSeen";

describe("useMarkWhatsNewSeen", () => {
  it("sends POST request to mark What's new as seen", async () => {
    const spy = server.mount(contract.users.markWhatsNewSeen, {
      body: { lastSeenAt: "2026-07-02T00:00:00.000Z" },
    });

    const { result } = renderHook(() => useMarkWhatsNewSeen());

    act(() => {
      result.current.mutate({});
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("invalidates the last-seen query on success", async () => {
    server.mount(contract.users.markWhatsNewSeen, {
      body: { lastSeenAt: "2026-07-02T00:00:00.000Z" },
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkWhatsNewSeen(), { queryClient });

    act(() => {
      result.current.mutate({});
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: WHATS_NEW_LAST_SEEN_KEY }),
      );
    });
  });

  it("invalidates the last-seen query even when the request fails", async () => {
    server.mount(contract.users.markWhatsNewSeen, { status: 401 });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkWhatsNewSeen(), { queryClient });

    act(() => {
      result.current.mutate({});
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: WHATS_NEW_LAST_SEEN_KEY }),
    );
  });
});
