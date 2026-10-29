import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Page from "./page";

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

const viewer = vi.hoisted(() => ({ isAnonymous: false }));
vi.mock("~/app/actions/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "user-1", isAnonymous: viewer.isAnonymous } }),
}));

vi.mock("@/components/whats-new/fetch-release-notes", () => ({
  fetchWebReleaseNotes: () =>
    Promise.resolve([
      { sys: { id: "note-1" }, title: "Sort by two columns", publishedAt: "2026-10-02T00:00:00Z" },
      { sys: { id: "note-2" }, title: null, publishedAt: "2026-09-30T00:00:00Z" },
      { sys: { id: "note-3" }, title: "Email notifications", publishedAt: "2026-09-24T00:00:00Z" },
      { sys: { id: "note-4" }, title: "Older", publishedAt: "2026-09-01T00:00:00Z" },
    ]),
}));

vi.mock("@/components/dashboard/home-notice", () => ({ HomeNotice: () => <p>Notice</p> }));
vi.mock("@/components/dashboard/get-started-section", () => ({
  GetStartedSection: () => <p>Get started</p>,
}));
vi.mock("@/components/dashboard/notifications-section", () => ({
  NotificationsSection: () => <p>Notifications</p>,
}));
vi.mock("@/components/dashboard/recently-opened-section", () => ({
  RecentlyOpenedSection: () => <p>Recently opened</p>,
}));
vi.mock("@/components/dashboard/public-research-section", () => ({
  PublicResearchSection: () => <p>Public research</p>,
}));
vi.mock("@/components/dashboard/blog-posts-section", () => ({
  BlogPostsSection: () => <p>Blog posts</p>,
}));
vi.mock("@/components/dashboard/activity-section", () => ({
  ActivitySection: () => <p>Last 30 days</p>,
}));
vi.mock("@/components/dashboard/feedback-links", () => ({
  FeedbackLinks: () => <p>Feedback</p>,
}));
vi.mock("@/components/dashboard/whats-new-section", () => ({
  WhatsNewSection: ({ entries }: { entries: { title: string }[] }) => (
    <p>{`What's new: ${entries.map((entry) => entry.title).join(", ")}`}</p>
  ),
}));

const renderHome = async () => render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));

const textOf = (element: Element | undefined) => element?.textContent ?? "";

describe("PlatformHome", () => {
  it("lets the shell own the heading and puts the notice and Get started above the columns", async () => {
    const { container } = await renderHome();

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    const [notice, getStarted] = Array.from(container.firstElementChild?.children ?? []);
    expect(textOf(notice)).toBe("Notice");
    expect(textOf(getStarted)).toBe("Get started");
  });

  it("puts the reader's work in the main column and what they glance at in the rail", async () => {
    await renderHome();

    const groupOf = (text: string) => screen.getByText(text).parentElement ?? undefined;

    expect(textOf(groupOf("Notifications"))).toBe("Notifications");
    expect(textOf(groupOf("Recently opened"))).toBe("Recently openedPublic researchBlog posts");
    expect(textOf(groupOf("Last 30 days"))).toBe(
      "Last 30 daysWhat's new: Sort by two columns, Email notificationsFeedback",
    );
  });

  it("orders the document as the one-column stack, Notifications above Recently opened", async () => {
    const { container } = await renderHome();

    expect(container).toHaveTextContent(
      /^NoticeGet startedNotificationsRecently openedPublic researchBlog postsLast 30 days/,
    );
  });

  it("fetches the sections that read on load on the server", async () => {
    await renderHome();

    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain('"listRecentlyOpened"');
    expect(queries).toContain('"listHomeExperiments"');
    expect(queries).toContain('"visibility":"public"');
    expect(queries).toContain('"readState":"unread"');
    expect(queries).not.toContain('"getUnreadNotificationCount"');
    expect(queries).toContain('"principal":"user-1"');
  });

  it("leaves out for a guest the notifications and activity the server refuses them", async () => {
    viewer.isAnonymous = true;
    try {
      const { container } = await renderHome();

      expect(container).not.toHaveTextContent("Notifications");
      expect(container).not.toHaveTextContent("Last 30 days");
      expect(container).toHaveTextContent("Recently opened");
      expect(JSON.stringify(prefetched.queries)).not.toContain('"listNotifications"');
    } finally {
      viewer.isAnonymous = false;
    }
  });
});
