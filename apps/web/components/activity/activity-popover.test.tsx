import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry } from "@/components/activity/activity-context";
import { render, screen, userEvent, act, waitFor, within } from "@/test/test-utils";
import * as React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { ActivityPopover, NOTIFICATION_BELL_OPEN_EVENT } from "./activity-popover";

function Seed({ entries }: { entries: ActivityEntry[] }) {
  const { upsert } = useActivity();
  React.useEffect(() => {
    entries.forEach(upsert);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);
  return null;
}

function renderPopover(entries: ActivityEntry[] = [], variant?: "icon" | "row") {
  return render(
    <>
      <Seed entries={entries} />
      <ActivityPopover variant={variant} />
    </>,
  );
}

const exportEntry: ActivityEntry = {
  id: "x1",
  kind: "data_export",
  title: "Export of Light Response (CSV)",
  status: "succeeded",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  resultUrl: "/api/experiments/exp-1/data/exports/x1/download",
};

describe("ActivityPopover", () => {
  it("shows the empty state when there is no activity", async () => {
    const user = userEvent.setup();
    renderPopover([]);
    await user.click(screen.getByLabelText(/Activity/i));
    expect(await screen.findByText(/Nothing to show yet/i)).toBeInTheDocument();
  });

  it("renders tracked entries with a status badge and result link", async () => {
    const user = userEvent.setup();
    renderPopover([exportEntry]);
    await user.click(screen.getByLabelText(/Activity/i));
    expect(await screen.findByText("Export of Light Response (CSV)")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    const link = screen.getByText("Export of Light Response (CSV)").closest("a");
    expect(link).toHaveAttribute("href", exportEntry.resultUrl);
  });

  it("renders a non-link row when an entry has no result url", async () => {
    const user = userEvent.setup();
    renderPopover([{ ...exportEntry, id: "x2", status: "running", resultUrl: undefined }]);
    await user.click(screen.getByLabelText(/Activity/i));
    const title = await screen.findByText("Export of Light Response (CSV)");
    expect(title.closest("a")).toBeNull();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("opens via the notification-bell event", async () => {
    renderPopover([exportEntry]);
    act(() => {
      window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));
    });
    expect(await screen.findByText("Activity")).toBeInTheDocument();
  });

  it("opens idempotently — a second event keeps the hub open", async () => {
    renderPopover([exportEntry]);
    act(() => {
      window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));
      window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT));
    });
    expect(await screen.findByText("Activity")).toBeInTheDocument();
  });

  it("renders every status badge, job kind, and relative time", async () => {
    const user = userEvent.setup();
    const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    renderPopover([
      {
        ...exportEntry,
        id: "a",
        kind: "data_export",
        status: "queued",
        title: "Queued job",
        updatedAt: minsAgo(0.2),
        resultUrl: undefined,
      },
      {
        ...exportEntry,
        id: "b",
        kind: "ambyte_processing",
        status: "running",
        title: "Ambyte job",
        updatedAt: minsAgo(30),
        resultUrl: undefined,
      },
      {
        ...exportEntry,
        id: "p",
        kind: "data_export",
        status: "pending",
        title: "Pending job",
        updatedAt: minsAgo(5),
        resultUrl: undefined,
      },
      {
        ...exportEntry,
        id: "c",
        kind: "metadata_reprocess",
        status: "failed",
        title: "Reprocess job",
        updatedAt: minsAgo(90),
        resultUrl: undefined,
      },
      {
        ...exportEntry,
        id: "d",
        kind: "data_export",
        status: "succeeded",
        title: "Old export",
        updatedAt: minsAgo(60 * 26),
        resultUrl: undefined,
      },
    ]);
    await user.click(screen.getByLabelText(/Activity/i));
    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText(/just now/)).toBeInTheDocument();
    expect(screen.getByText(/30 min ago/)).toBeInTheDocument();
    expect(screen.getByText(/1h ago/)).toBeInTheDocument();
    expect(screen.getByText(/1d ago/)).toBeInTheDocument();
  });

  it("marks all read from the popover header", async () => {
    const user = userEvent.setup();
    renderPopover([exportEntry]);
    await user.click(screen.getByLabelText(/Activity/i));
    await user.click(await screen.findByText("Mark all read"));
    expect(screen.getByText("Export of Light Response (CSV)")).toBeInTheDocument();
  });

  it("surfaces an unread dot and clears it on open", async () => {
    const user = userEvent.setup();
    renderPopover([exportEntry]);
    // unread badge encoded in the aria-label
    expect(screen.getByLabelText(/Activity \(1 unread\)/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Activity/i));
    expect(await screen.findByText("Export of Light Response (CSV)")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Activity$/i)).toBeInTheDocument();
  });

  it("renders as a labeled sidebar row in the row variant", async () => {
    const user = userEvent.setup();
    renderPopover([exportEntry], "row");

    // The row carries a visible label and the same unread indicator, and opens
    // the same hub — the sidebar's secondary-nav form of the bell.
    const row = screen.getByRole("button", { name: /Activity \(1 unread\)/i });
    expect(screen.getByTestId("bell-indicator")).toBeInTheDocument();
    await user.click(row);
    expect(await screen.findByText("Export of Light Response (CSV)")).toBeInTheDocument();
  });
});

/**
 * Organization invitations are the bell's second source, and not an activity entry:
 * they are server-held, have no job status, and stay actionable until answered —
 * where an entry is this tab's own in-memory record of something it started.
 */
describe("ActivityPopover — organization invitations", () => {
  const listUserInvitations = () => vi.mocked(authClient.organization.listUserInvitations);

  const invitation = {
    id: "invitation-1",
    email: "ada@example.com",
    role: "admin",
    organizationId: "org-1",
    organizationName: "Helix Lab",
    inviterId: "user-9",
    status: "pending",
    expiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  function signedIn() {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-a" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  }

  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    listUserInvitations().mockResolvedValue({ data: [], error: null });
  });

  it("lists a pending invitation in its own section, linked to where it is answered", async () => {
    const user = userEvent.setup();
    signedIn();
    listUserInvitations().mockResolvedValue({ data: [invitation], error: null });

    renderPopover([]);
    await user.click(screen.getByLabelText(/Activity/i));

    const section = await screen.findByTestId("bell-invitations");
    expect(within(section).getByText("organizations.myInvitations.title")).toBeVisible();
    expect(within(section).getByText("Helix Lab")).toBeVisible();
    // The role is on the row: it is what the recipient would be agreeing to.
    expect(within(section).getByText(/organizations\.roles\.admin/)).toBeVisible();
    expect(within(section).getByRole("link")).toHaveAttribute(
      "href",
      "/en-US/platform/account/invitations",
    );

    // The job list keeps its own header and its own empty state alongside.
    expect(screen.getByText("Activity")).toBeVisible();
    expect(screen.getByText(/Nothing to show yet/i)).toBeVisible();
  });

  /**
   * `unreadCount` is answered by `lastSeenAt`, which lives in memory and resets on
   * reload. An invitation is not read or unread — it is unanswered — so it drives the
   * dot on its own, with no job in the tracker at all.
   */
  it("raises the indicator with no unread jobs, and does not clear it on open", async () => {
    const user = userEvent.setup();
    signedIn();
    listUserInvitations().mockResolvedValue({ data: [invitation], error: null });

    renderPopover([]);

    expect(await screen.findByTestId("bell-indicator")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Activity/i));
    expect(await screen.findByTestId("bell-invitations")).toBeInTheDocument();
    expect(screen.getByTestId("bell-indicator")).toBeInTheDocument();
  });

  /**
   * The failure this section exists to prevent. Better Auth refuses this endpoint
   * outright for an address it considers unverified, and rendering that as "no
   * invitations" would hide one the recipient can still accept.
   */
  it("renders a failed read as an error with a retry, not as an absent section", async () => {
    const user = userEvent.setup();
    signedIn();
    listUserInvitations().mockResolvedValue({
      data: null,
      error: { message: "Email verification is required", status: 403 },
    });

    renderPopover([]);
    await user.click(screen.getByLabelText(/Activity/i));

    const error = await screen.findByTestId("bell-invitations-error");
    expect(within(error).getByText("organizations.myInvitations.loadError")).toBeVisible();
    expect(
      within(error).getByRole("button", { name: "organizations.myInvitations.retry" }),
    ).toBeVisible();

    // And a failure the user cannot clear must not leave a permanent dot on the bell.
    expect(screen.queryByTestId("bell-indicator")).not.toBeInTheDocument();
  });

  it("shows no invitation section when there is none waiting", async () => {
    const user = userEvent.setup();
    signedIn();
    listUserInvitations().mockResolvedValue({ data: [], error: null });

    renderPopover([]);
    await user.click(screen.getByLabelText(/Activity/i));

    expect(await screen.findByText(/Nothing to show yet/i)).toBeVisible();
    await waitFor(() => {
      expect(listUserInvitations()).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("bell-invitations")).not.toBeInTheDocument();
  });
});
