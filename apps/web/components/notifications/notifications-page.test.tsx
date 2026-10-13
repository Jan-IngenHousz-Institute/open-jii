import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
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

function page(items: Notification[], overrides: { totalPages?: number; page?: number } = {}) {
  return {
    items,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalCount: items.length,
    ...overrides,
  };
}

/** Day boundaries the feed groups against, so a case does not depend on the hour it runs at. */
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const hoursBeforeToday = (hours: number) =>
  new Date(startOfToday.getTime() - hours * 60 * 60 * 1000).toISOString();

const markAllRead = () => screen.getByRole("button", { name: "markAllRead" });
const categoryFilter = () => screen.getByRole("combobox", { name: "filters.category" });
const lastQuery = (spy: { calls: { query: Record<string, string> }[] }) => spy.calls.at(-1)?.query;

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

  it("heads the rows with the day they arrived, newest group first", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([
        createNotification({ id: "00000000-0000-4000-8000-000000000011" }),
        createNotification({
          id: "00000000-0000-4000-8000-000000000012",
          type: "experiment_join_request_approved",
          createdAt: hoursBeforeToday(1),
        }),
        createNotification({
          id: "00000000-0000-4000-8000-000000000013",
          type: "experiment_join_request_rejected",
          createdAt: hoursBeforeToday(48),
        }),
      ]),
    });

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "groups.today",
      "groups.yesterday",
      "groups.earlier",
    ]);

    const today = screen.getByRole("region", { name: "groups.today" });
    expect(within(today).getByText("types.experiment_join_request_received")).toBeVisible();
    const earlier = screen.getByRole("region", { name: "groups.earlier" });
    expect(within(earlier).getByText("types.experiment_join_request_rejected")).toBeVisible();
  });

  it("leaves out a day nothing arrived on", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([
        createNotification({ id: "00000000-0000-4000-8000-000000000011" }),
        createNotification({
          id: "00000000-0000-4000-8000-000000000013",
          type: "experiment_join_request_rejected",
          createdAt: hoursBeforeToday(48),
        }),
      ]),
    });

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    expect(screen.getByText("groups.today")).toBeVisible();
    expect(screen.getByText("groups.earlier")).toBeVisible();
    expect(screen.queryByText("groups.yesterday")).not.toBeInTheDocument();
  });

  it("asks for unread rows only on the Unread tab", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    const listRequest = server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    await user.click(screen.getByRole("tab", { name: "filters.unread" }));

    await waitFor(() => expect(lastQuery(listRequest)?.readState).toBe("unread"));
  });

  it("asks for one category when one is picked", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    const listRequest = server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    await user.click(categoryFilter());
    await user.click(screen.getByRole("option", { name: "categories.data_jobs.label" }));

    await waitFor(() => expect(lastQuery(listRequest)?.category).toBe("data_jobs"));
  });

  it("goes back to the first page when a filter changes", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    const listRequest = server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()], { totalPages: 3 }),
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    await waitFor(() => expect(lastQuery(listRequest)?.page).toBe("2"));

    await user.click(screen.getByRole("tab", { name: "filters.unread" }));

    await waitFor(() => expect(lastQuery(listRequest)?.page).toBe("1"));
    expect(lastQuery(listRequest)?.readState).toBe("unread");

    // The two handlers do not share the reset, so the category path needs its own
    // trip forward: a page-2 request followed by a category that lands on page 1.
    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    await waitFor(() => expect(lastQuery(listRequest)?.page).toBe("2"));

    await user.click(categoryFilter());
    await user.click(screen.getByRole("option", { name: "categories.data_jobs.label" }));

    await waitFor(() => expect(lastQuery(listRequest)?.page).toBe("1"));
    expect(lastQuery(listRequest)?.category).toBe("data_jobs");
  });

  it("pages only when there is more than one page", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    expect(screen.queryByRole("button", { name: "pagination.next" })).not.toBeInTheDocument();
  });

  it("says which filter emptied the list", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 0 } });
    server.mount(contract.notifications.listNotifications, { body: page([]) });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    expect(await screen.findByText("empty.description")).toBeVisible();
    // Unfiltered, the reader really is caught up; under a filter the title must not
    // claim it over rows the filter is hiding.
    expect(screen.getByText("empty.title")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "filters.unread" }));
    expect(await screen.findByText("empty.unread")).toBeVisible();
    expect(screen.getByText("empty.filteredTitle")).toBeVisible();
    expect(screen.queryByText("empty.title")).not.toBeInTheDocument();

    await user.click(categoryFilter());
    await user.click(screen.getByRole("option", { name: "categories.data_jobs.label" }));
    expect(await screen.findByText("empty.category")).toBeVisible();
    expect(screen.getByText("empty.filteredTitle")).toBeVisible();
  });

  it("snaps back into range when the result set shrinks under the current page", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    // Page 2 has emptied out, as the Unread view does when the last row on it is
    // opened. Without a clamp the reader is left on a page that no longer exists.
    const listRequest = server.mount(contract.notifications.listNotifications, {
      body: ({ query }: SpyCall) =>
        query.page === "2"
          ? page([], { page: 2, totalPages: 1 })
          : page([createNotification()], { totalPages: 2 }),
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await screen.findByText("types.experiment_join_request_received");
    await user.click(screen.getByRole("button", { name: "pagination.next" }));

    await waitFor(() => expect(lastQuery(listRequest)?.page).toBe("1"));
    expect(await screen.findByText("types.experiment_join_request_received")).toBeVisible();
    expect(screen.queryByText("empty.unread")).not.toBeInTheDocument();
  });

  it("holds the previous filter's rows inert while the new one is in flight", async () => {
    server.mount(contract.notifications.getUnreadNotificationCount, { body: { count: 1 } });
    server.mount(contract.notifications.listNotifications, {
      body: page([createNotification()]),
    });
    const user = userEvent.setup();

    render(<NotificationsPage />);

    const row = await screen.findByText("types.experiment_join_request_received");
    // The card itself, not whatever happens to carry aria-busy, so dropping the
    // treatment fails on the missing attribute rather than on a null element.
    const card = row.closest("div.bg-card");
    expect(card).toHaveAttribute("aria-busy", "false");

    // Mounted after the first read has landed, so only the filter change hangs.
    server.mount(contract.notifications.listNotifications, { delay: "infinite" });
    await user.click(screen.getByRole("tab", { name: "filters.unread" }));

    // The rows on screen belong to the filter the reader just left; they must not
    // read as the answer to the new one.
    await waitFor(() => expect(card).toHaveAttribute("aria-busy", "true"));
    expect(card).toHaveAttribute("inert");
    expect(card).toHaveClass("opacity-50");
  });
});
