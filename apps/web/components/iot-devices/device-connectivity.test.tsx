import { render, renderHook, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ConnectivityDot, useFormatLastSeen } from "./device-connectivity";

describe("ConnectivityDot", () => {
  it("shows connected for an online device", () => {
    render(<ConnectivityDot connectivity={{ connected: true, lastSeenAt: null }} />);

    expect(screen.getByText("iot.devices.connectivity.connected")).toBeInTheDocument();
  });

  it("shows disconnected for an offline device", () => {
    render(
      <ConnectivityDot
        connectivity={{ connected: false, lastSeenAt: "2026-08-13T08:00:00.000Z" }}
      />,
    );

    expect(screen.getByText("iot.devices.connectivity.disconnected")).toBeInTheDocument();
  });

  it("shows unknown when the fleet index is unavailable", () => {
    render(<ConnectivityDot connectivity={null} />);

    expect(screen.getByText("iot.devices.connectivity.unknown")).toBeInTheDocument();
  });
});

describe("useFormatLastSeen", () => {
  it("labels a connected device as connected now", () => {
    const { result } = renderHook(() => useFormatLastSeen());

    expect(result.current({ connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" })).toBe(
      "iot.devices.connectivity.connectedNow",
    );
  });

  it("renders a relative time for a disconnected device", () => {
    const { result } = renderHook(() => useFormatLastSeen());

    const label = result.current({
      connected: false,
      lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    });

    expect(label).toMatch(/5 minutes ago/);
  });

  it("labels a never-connected device honestly", () => {
    const { result } = renderHook(() => useFormatLastSeen());

    expect(result.current({ connected: false, lastSeenAt: null })).toBe(
      "iot.devices.connectivity.never",
    );
  });

  it("labels an unknown state when connectivity is null", () => {
    const { result } = renderHook(() => useFormatLastSeen());

    expect(result.current(null)).toBe("iot.devices.connectivity.unknown");
  });
});
