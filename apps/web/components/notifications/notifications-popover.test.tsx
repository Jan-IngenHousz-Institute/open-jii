import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { authClient, useSession } from "@repo/auth/client";

import { NOTIFICATION_BELL_OPEN_EVENT, NotificationsPopover } from "./notifications-popover";

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
  return { items, page: 1, pageSize: 10, totalPages: 1, totalCount: items.length };
}

describe("<NotificationsPopover />", () => {
  // Files share a module registry here, so the two account mocks go back to their
  // defaults rather than following the suite into the next file.
  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    vi.mocked(authClient.organization.listUserInvitations).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("lights the indicator while something is unread", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 2 } });

    render(<NotificationsPopover />);

    expect(await screen.findByTestId("bell-indicator")).toBeInTheDocument();
  });

  it("shows no indicator when everything is read", async () => {
    const countRequest = server.mount(contract.notifications.getUnreadNotificationCount, {
      body: { count: 0 },
    });

    render(<NotificationsPopover />);

    await waitFor(() => expect(countRequest.called).toBe(true));
    expect(screen.queryByTestId("bell-indicator")).not.toBeInTheDocument();
  });

  /**
   * A pending invitation no longer lights the bell on its own: it arrives as an
   * ordinary notification row, so the dot follows the unread count and nothing else.
   */
  it("shows no indicator for a pending invitation once everything is read", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-a" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(authClient.organization.listUserInvitations).mockResolvedValue({
      data: [
        {
          id: "invitation-1",
          email: "ada@example.com",
          role: "member",
          organizationId: "org-1",
          organizationName: "Helix Lab",
          inviterId: "user-9",
          status: "pending",
          expiresAt: new Date(Date.now() + 3_600_000),
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
      error: null,
    } as Awaited<ReturnType<typeof authClient.organization.listUserInvitations>>);
    const countRequest = server.mount(contract.notifications.getUnreadNotificationCount, {
      body: { count: 0 },
    });

    render(<NotificationsPopover />);

    await waitFor(() => expect(countRequest.called).toBe(true));
    expect(screen.queryByTestId("bell-indicator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bell-invitations")).not.toBeInTheDocument();
  });

  it("offers Mark all read against the rows on screen while the count is behind", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification({ readAt: null })]),
    });
    const user = userEvent.setup();
    render(<NotificationsPopover />);

    await user.click(screen.getByRole("button", { name: /title/ }));
    await screen.findByText("types.experiment_join_request_received");

    expect(screen.getByRole("button", { name: "markAllRead" })).toBeEnabled();
  });

  it("lists the latest notifications when opened", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    const listRequest = server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });
    const user = userEvent.setup();
    render(<NotificationsPopover />);

    await user.click(screen.getByRole("button", { name: /title/ }));

    expect(await screen.findByText("types.experiment_join_request_received")).toBeVisible();
    expect(screen.getByTestId("notification-unread-dot")).toBeInTheDocument();
    expect(listRequest.calls.at(-1)?.query).toMatchObject({ page: "1", pageSize: "10" });
  });

  it("marks an unread notification read when it is opened", async () => {
    const notification = createNotification();
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    server.mount(contract.notifications.listNotifications, { body: page([notification]) });
    const markRequest = server.mount(contract.notifications.markNotificationsRead, {
      body: { updated: 1 },
    });
    const user = userEvent.setup();
    render(<NotificationsPopover />);

    await user.click(screen.getByRole("button", { name: /title/ }));
    await user.click(await screen.findByText("types.experiment_join_request_received"));

    await waitFor(() => expect(markRequest.body).toEqual({ ids: [notification.id] }));
  });

  it("marks everything read from the header", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 3 } });
    server.mount(contract.notifications.listNotifications, { body: page([createNotification()]) });
    const markAllRequest = server.mount(contract.notifications.markAllNotificationsRead, {
      body: { updated: 3 },
    });
    const user = userEvent.setup();
    render(<NotificationsPopover />);

    await user.click(screen.getByRole("button", { name: /title/ }));
    await user.click(await screen.findByRole("button", { name: "markAllRead" }));

    await waitFor(() => expect(markAllRequest.called).toBe(true));
  });

  it("says so when there is nothing to show", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, { body: page([]) });
    render(<NotificationsPopover />);

    window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));

    expect(await screen.findByText("empty.title")).toBeVisible();
    expect(screen.getByRole("button", { name: "markAllRead" })).toBeDisabled();
  });

  it("offers a retry when the list fails to load", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    server.mount(contract.notifications.listNotifications, { status: 500 });
    render(<NotificationsPopover />);

    window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));

    expect(await screen.findByText("loadError")).toBeVisible();
    expect(screen.getByRole("button", { name: "retry" })).toBeVisible();
  });

  it("has no settings entry: preferences are not built yet", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, { body: page([]) });
    render(<NotificationsPopover />);

    window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));

    expect(await screen.findByRole("link", { name: "seeAll" })).toHaveAttribute(
      "href",
      "/en-US/platform/notifications",
    );
    expect(screen.queryByRole("link", { name: "settings" })).not.toBeInTheDocument();
  });
});
