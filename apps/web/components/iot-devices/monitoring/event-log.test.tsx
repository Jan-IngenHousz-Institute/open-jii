import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceLifecycleEvent } from "@repo/api/domains/iot/iot.schema";

import { EventLog } from "./event-log";

function events(count: number): DeviceLifecycleEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    eventType: index % 2 === 0 ? "connected" : "disconnected",
    eventTimestamp: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
    disconnectReason: index % 2 === 0 ? null : "CONNECTION_LOST",
    sessionIdentifier: "s-1",
  }));
}

describe("EventLog", () => {
  it("renders the empty state without events", () => {
    render(<EventLog events={[]} />);

    expect(screen.getByText("iot.devices.monitoring.noEvents")).toBeInTheDocument();
  });

  it("shows newest first with a dash for reason-less connects", () => {
    render(<EventLog events={events(2)} />);

    const rows = screen.getAllByRole("row");
    // Header row, then the disconnect (newest), then the connect.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("CONNECTION_LOST");
    expect(rows[2]).toHaveTextContent("-");
  });

  it("paginates past 25 events", async () => {
    const user = userEvent.setup();
    render(<EventLog events={events(26)} />);

    // 25 rows + header on page one, the remaining event on page two.
    expect(screen.getAllByRole("row")).toHaveLength(26);
    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.next" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("clamps the page when the list shrinks under it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EventLog events={events(26)} />);
    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.next" }));

    // A narrower range refetch leaves fewer events than the open page.
    rerender(<EventLog events={events(3)} />);

    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
});
