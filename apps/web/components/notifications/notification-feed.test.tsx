import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@repo/api/domains/notification/notification.schema";

import { NotificationFeed } from "./notification-feed";

const LATE_LAST_NIGHT: Notification = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "experiment_join_request_received",
  category: "requests_and_invitations",
  actor: { id: "00000000-0000-4000-8000-0000000000aa", name: "Ada Lovelace" },
  resource: { type: "experiment", id: "00000000-0000-4000-8000-0000000000bb" },
  params: { experimentName: "Drought trial" },
  readAt: null,
  createdAt: "2026-10-08T23:30:00.000Z",
};

describe("NotificationFeed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups by the UTC day on the server, which is what the page hydrates against", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T00:30:00.000Z"));

    const html = renderToString(
      <NotificationFeed
        notifications={[LATE_LAST_NIGHT]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        empty={null}
        groupByDay
      />,
    );

    // Already today in any zone ahead of UTC.
    expect(html).toContain("groups.yesterday");
    expect(html).not.toContain("groups.today");
  });
});
