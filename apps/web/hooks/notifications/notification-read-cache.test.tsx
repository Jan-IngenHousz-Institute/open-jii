import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  Notification,
  NotificationList,
} from "@repo/api/domains/notification/notification.schema";

import { useMarkAllNotificationsRead } from "./useMarkAllNotificationsRead/useMarkAllNotificationsRead";
import { useMarkNotificationsRead } from "./useMarkNotificationsRead/useMarkNotificationsRead";

const FIRST = "00000000-0000-4000-8000-000000000001";
const SECOND = "00000000-0000-4000-8000-000000000002";
const listKey = withPrincipal(orpc.notifications.listNotifications.queryKey({ input: {} }), "u1");
const countKey = withPrincipal(orpc.notifications.getUnreadNotificationCount.queryKey(), "u1");

function createNotification(id: string): Notification {
  return {
    id,
    type: "experiment_join_request_received",
    category: "requests_and_invitations",
    actor: null,
    resource: null,
    params: { experimentName: "Drought trial" },
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

// Seeded entries have no observer, so they must outlive the default zero gcTime.
function createSeededClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const items = [createNotification(FIRST), createNotification(SECOND)];
  queryClient.setQueryData(listKey, { items, page: 1, pageSize: 10, totalPages: 1, totalCount: 2 });
  queryClient.setQueryData(countKey, { count: 5 });
  return queryClient;
}

function readIds(queryClient: QueryClient) {
  const list = queryClient.getQueryData<NotificationList>(listKey);
  return list?.items.filter((item) => item.readAt !== null).map((item) => item.id);
}

describe("marking notifications read", () => {
  it("shows the chosen notifications read and lowers the badge before the server answers", async () => {
    const queryClient = createSeededClient();
    server.mount(contract.notifications.markNotificationsRead, {
      body: { updated: 1 },
      delay: 200,
    });
    const { result } = renderHook(() => useMarkNotificationsRead(), { queryClient });

    act(() => result.current.mutate({ ids: [FIRST] }));

    await waitFor(() => expect(readIds(queryClient)).toEqual([FIRST]));
    expect(queryClient.getQueryData(countKey)).toEqual({ count: 4 });
  });

  it("marks every notification read and clears the badge for mark all", async () => {
    const queryClient = createSeededClient();
    server.mount(contract.notifications.markAllNotificationsRead, {
      body: { updated: 5 },
      delay: 200,
    });
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { queryClient });

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(readIds(queryClient)).toEqual([FIRST, SECOND]));
    expect(queryClient.getQueryData(countKey)).toEqual({ count: 0 });
  });

  it("puts the unread state back when the server refuses", async () => {
    const queryClient = createSeededClient();
    server.mount(contract.notifications.markNotificationsRead, { status: 500 });
    const { result } = renderHook(() => useMarkNotificationsRead(), { queryClient });

    act(() => result.current.mutate({ ids: [FIRST] }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readIds(queryClient)).toEqual([]);
    expect(queryClient.getQueryData(countKey)).toEqual({ count: 5 });
  });
});
