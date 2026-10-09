import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { auth } from "~/app/actions/auth";
import { orpc } from "~/lib/orpc";

import NotificationsRoute from "./page";

vi.mock("~/components/notifications/notifications-page", () => ({
  NotificationsPage: () => <div data-testid="notifications" />,
}));

const prefetched = vi.hoisted(() => {
  const state: { queries: unknown[] } = { queries: [] };
  return state;
});

vi.mock("@/components/server-prefetch/prefetched-queries", () => ({
  PrefetchedQueries: ({
    queries,
    children,
  }: {
    queries: (utils: unknown) => unknown[];
    children: React.ReactNode;
  }) => {
    prefetched.queries = queries(orpc);
    return children;
  },
}));

describe("NotificationsRoute", () => {
  it("fetches the person's first page of notifications while the server renders", async () => {
    vi.mocked(auth).mockResolvedValue(createSession({ user: { id: "user-ana" } }));

    render(await NotificationsRoute());

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByTestId("notifications")).toBeInTheDocument();
    expect(queries).toContain("listNotifications");
    expect(queries).toContain('"pageSize":50');
    expect(queries).toContain("user-ana");
  });
});
