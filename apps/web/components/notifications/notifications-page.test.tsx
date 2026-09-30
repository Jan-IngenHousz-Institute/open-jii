import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { Notification } from "@repo/api/domains/notification/notification.schema";

import { NotificationsPage } from "./notifications-page";

function createNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type: "experiment_join_request_received",
    category: "requests_and_invitations",
    actor: { id: "00000000-0000-4000-8000-0000000000aa", name: "Ada Lovelace" },
    resource: { type: "experiment", id: "00000000-0000-4000-8000-0000000000bb" },
    params: { experimentName: "Drought trial" },
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(items: Notification[]) {
  return { items, page: 1, pageSize: 50, totalPages: 1, totalCount: items.length };
}

const markAllRead = () => screen.getByRole("button", { name: "markAllRead" });

describe("<NotificationsPage />", () => {
  it("lists what it was given", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });

    render(<NotificationsPage />);

    expect(await screen.findByText("types.experiment_join_request_received")).toBeVisible();
    expect(screen.getByTestId("notification-unread-dot")).toBeInTheDocument();
  });

  it("offers Mark all read against the rows on screen, not only against the count", async () => {
    // The count read never answers. The reader is looking at an unread row, so the
    // button it would use must not be dead.
    server.mount(contract.notifications.getUnreadNotificationCount, { status: 500 });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });
    const markAllRequest = server.mount(contract.notifications.markAllNotificationsRead, {
      body: { updated: 1 },
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await waitFor(() => expect(markAllRead()).toBeEnabled());
    await user.click(markAllRead());

    await waitFor(() => expect(markAllRequest.called).toBe(true));
  });

  it("leaves Mark all read disabled once everything listed is read", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification({ readAt: new Date().toISOString() })]),
    });

    render(<NotificationsPage />);

    expect(await screen.findByText("types.experiment_join_request_received")).toBeVisible();
    expect(markAllRead()).toBeDisabled();
  });

  it("says so when there is nothing to show", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, { body: page([]) });

    render(<NotificationsPage />);

    expect(await screen.findByText("empty.title")).toBeVisible();
  });
});
