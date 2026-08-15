import { render, screen, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LivenessChip, parseWarehouseTimestamp } from "./liveness-chip";

describe("parseWarehouseTimestamp", () => {
  // Expectations are built with Date.UTC rather than by parsing a string, so a
  // regression to local-time parsing shows up on any machine outside UTC.
  it("reads a zoneless warehouse timestamp as UTC", () => {
    expect(parseWarehouseTimestamp("2026-08-14 11:45:00")?.getTime()).toBe(
      Date.UTC(2026, 7, 14, 11, 45, 0),
    );
  });

  it("keeps an explicit zone as given", () => {
    expect(parseWarehouseTimestamp("2026-08-14T11:45:00Z")?.toISOString()).toBe(
      "2026-08-14T11:45:00.000Z",
    );
    expect(parseWarehouseTimestamp("2026-08-14T13:45:00+02:00")?.toISOString()).toBe(
      "2026-08-14T11:45:00.000Z",
    );
  });

  it("returns null for unparseable text", () => {
    expect(parseWarehouseTimestamp("not-a-date")).toBeNull();
  });
});

describe("LivenessChip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the chip once the timestamp resolves", async () => {
    render(<LivenessChip lastMeasurementAt="2026-08-14 11:45:00" locale="en-US" />);

    await waitFor(() => {
      expect(screen.getByText("lastMeasurement")).toBeInTheDocument();
    });
  });

  it("renders nothing for an unparseable timestamp", async () => {
    const { container } = render(<LivenessChip lastMeasurementAt="not-a-date" locale="en-US" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
