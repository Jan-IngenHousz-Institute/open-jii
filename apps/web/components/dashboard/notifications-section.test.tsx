import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { Notification } from "@repo/api/domains/notification/notification.schema";

import { NotificationsSection } from "./notifications-section";

function createNotification(id: string): Notification {
  return {
    id,
    type: "experiment_join_request_received",
    category: "requests_and_invitations",
    actor: { id: "00000000-0000-4000-8000-0000000000aa", name: "Ada Lovelace" },
    resource: { type: "experiment", id: "00000000-0000-4000-8000-0000000000bb" },
    params: { experimentName: "Drought trial" },
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

const page = (items: Notification[]) => ({
  items,
  page: 1,
  pageSize: 5,
  totalPages: 1,
  totalCount: items.length,
});

describe("NotificationsSection", () => {
  it("lists unread notifications under the bell's count, with See all", async () => {
    const list = server.mount(contract.notifications.listNotifications, {
      body: page([
        createNotification("00000000-0000-4000-8000-000000000001"),
        createNotification("00000000-0000-4000-8000-000000000002"),
      ]),
    });
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 7 } });

    render(<NotificationsSection />);

    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    expect(list.calls[0]?.query).toMatchObject({ readState: "unread", page: "1", pageSize: "5" });
    expect(screen.getByRole("heading", { name: "title unreadCount" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dashboard.seeAll" })).toHaveAttribute(
      "href",
      "/en-US/platform/notifications",
    );
  });

  it("marks a notification read when it is opened", async () => {
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification("00000000-0000-4000-8000-000000000001")]),
    });
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    const markRead = server.mount(contract.notifications.markNotificationsRead, {
      body: { updated: 1 },
    });
    const user = userEvent.setup();

    render(<NotificationsSection />);

    await user.click(await screen.findByRole("link", { name: /types\./ }));

    await waitFor(() =>
      expect(markRead.body).toEqual({ ids: ["00000000-0000-4000-8000-000000000001"] }),
    );
  });

  it("renders nothing while nothing is unread", async () => {
    const list = server.mount(contract.notifications.listNotifications, { body: page([]) });
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });

    const { container } = render(<NotificationsSection />);

    await waitFor(() => expect(list.called).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });
});
