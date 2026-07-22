import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useNewsletterStatus } from "./useNewsletterStatus/useNewsletterStatus";
import { useSubscribeNewsletter } from "./useSubscribeNewsletter/useSubscribeNewsletter";
import { useUnsubscribeNewsletter } from "./useUnsubscribeNewsletter/useUnsubscribeNewsletter";

describe("newsletter hooks", () => {
  it("reads the live newsletter status", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "pending" } });

    const { result } = renderHook(() => useNewsletterStatus());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: "pending" });
  });

  it("uses the direct-subscribe route and invalidates status", async () => {
    const request = server.mount(contract.newsletter.subscribeDirect, {
      body: { status: "subscribed" },
    });
    server.mount(contract.newsletter.getStatus, { body: { status: "subscribed" } });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubscribeNewsletter(), { queryClient });

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request.called).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: orpc.newsletter.getStatus.key(),
    });
  });

  it("uses the unsubscribe route and invalidates status", async () => {
    const request = server.mount(contract.newsletter.unsubscribe, {
      body: { status: "unsubscribed" },
    });
    server.mount(contract.newsletter.getStatus, { body: { status: "unsubscribed" } });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUnsubscribeNewsletter(), { queryClient });

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request.called).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: orpc.newsletter.getStatus.key(),
    });
  });

  it("invalidates status when a mutation fails", async () => {
    server.mount(contract.newsletter.subscribeDirect, { status: 503 });
    server.mount(contract.newsletter.getStatus, { body: { status: "none" } });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubscribeNewsletter(), { queryClient });

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: orpc.newsletter.getStatus.key(),
    });
  });
});
