import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ActivityIndicator, parseWarehouseTimestamp } from "./activity-indicator";

describe("parseWarehouseTimestamp", () => {
  // Expectations are built with Date.UTC rather than by parsing a string, so a
  // regression to local-time parsing shows up on any machine outside UTC.
  it("reads a zoneless warehouse timestamp as UTC", () => {
    expect(parseWarehouseTimestamp("2026-08-14 11:45:00")?.getTime()).toBe(
      Date.UTC(2026, 7, 14, 11, 45, 0),
    );
  });

  it("keeps an explicit zone as given", () => {
    expect(parseWarehouseTimestamp("2026-08-14T13:45:00+02:00")?.getTime()).toBe(
      Date.UTC(2026, 7, 14, 11, 45, 0),
    );
  });

  it("returns null for unparseable text", () => {
    expect(parseWarehouseTimestamp("not-a-date")).toBeNull();
  });
});

describe("ActivityIndicator", () => {
  it("shows the moving 24h count when there is activity", () => {
    render(
      <ActivityIndicator
        measurements24h={1428}
        lastMeasurementAt="2026-08-28 10:00:00"
        locale="en-US"
      />,
    );

    expect(screen.getByText("indicator.active")).toBeInTheDocument();
  });

  it("falls back to quiet-since only when there is silence to report", async () => {
    render(
      <ActivityIndicator
        measurements24h={0}
        lastMeasurementAt="2026-08-01 10:00:00"
        locale="en-US"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("indicator.quiet")).toBeInTheDocument();
    });
  });

  it("renders nothing without activity or a last timestamp", () => {
    const { container } = render(
      <ActivityIndicator measurements24h={0} lastMeasurementAt={null} locale="en-US" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
