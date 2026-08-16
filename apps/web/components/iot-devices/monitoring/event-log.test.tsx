import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ActivityEntry } from "./device-activity";
import { EventLog } from "./event-log";

function entries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
    kind: index % 2 === 0 ? "connected" : "disconnected",
    detail: index % 2 === 0 ? null : "CONNECTION_LOST",
  }));
}

describe("EventLog", () => {
  it("renders the empty state without activity", () => {
    render(<EventLog entries={[]} />);

    expect(screen.getByText("iot.devices.monitoring.noEvents")).toBeInTheDocument();
  });

  it("labels each kind of activity, not only disconnects", () => {
    render(
      <EventLog
        entries={[
          { timestamp: "2026-08-13T03:00:00.000Z", kind: "firmwareChanged", detail: "1.0 → 1.1" },
          { timestamp: "2026-08-13T02:00:00.000Z", kind: "registered", detail: null },
          {
            timestamp: "2026-08-13T01:00:00.000Z",
            kind: "disconnected",
            detail: "CONNECTION_LOST",
          },
        ]}
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.activity.firmwareChanged")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.activity.registered")).toBeInTheDocument();
    expect(screen.getByText("1.0 → 1.1")).toBeInTheDocument();
    expect(screen.getByText("CONNECTION_LOST")).toBeInTheDocument();
  });

  it("shows a dash where an entry carries no detail", () => {
    render(
      <EventLog
        entries={[{ timestamp: "2026-08-13T01:00:00.000Z", kind: "connected", detail: null }]}
      />,
    );

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("paginates past 25 entries and clamps the page when the list shrinks", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EventLog entries={entries(26)} />);

    expect(screen.getAllByRole("row")).toHaveLength(26);
    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.next" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);

    rerender(<EventLog entries={entries(3)} />);
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
});
