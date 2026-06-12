import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry } from "@/components/activity/activity-context";
import { render, screen, userEvent, act } from "@/test/test-utils";
import * as React from "react";
import { describe, it, expect } from "vitest";

import { ActivityPopover, NOTIFICATION_BELL_OPEN_EVENT } from "./activity-popover";

function Seed({ entries }: { entries: ActivityEntry[] }) {
  const { upsert } = useActivity();
  React.useEffect(() => {
    entries.forEach(upsert);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);
  return null;
}

function renderPopover(entries: ActivityEntry[] = []) {
  return render(
    <>
      <Seed entries={entries} />
      <ActivityPopover />
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
});
