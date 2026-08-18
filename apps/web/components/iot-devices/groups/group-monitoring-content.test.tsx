import { createDeviceGroupMemberHealth } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { GroupMonitoringContent } from "./group-monitoring-content";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

const STALE = "2026-08-18T00:00:00.000Z";

interface MonitoringBody {
  members: ReturnType<typeof createDeviceGroupMemberHealth>[];
  throughput?: { bucketStart: string | null; deviceId: string | null; count: number }[];
  events?: {
    deviceId: string | null;
    eventType: string | null;
    eventTimestamp: string | null;
    disconnectReason: string | null;
  }[];
  pipelineUnavailable?: boolean;
}

function mountMonitoring(body: MonitoringBody) {
  server.mount(contract.deviceGroups.getDeviceGroupMonitoring, {
    body: {
      throughput: [],
      events: [],
      pipelineUnavailable: false,
      ...body,
    },
  });
}

describe("GroupMonitoringContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  });

  it("renders tiles, roster, throughput, and the event log for one window", async () => {
    const gateway = createDeviceGroupMemberHealth({
      name: "Gateway One",
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: STALE,
    });
    mountMonitoring({
      members: [gateway],
      throughput: [{ bucketStart: STALE, deviceId: gateway.deviceId, count: 7 }],
      events: [
        {
          deviceId: gateway.deviceId,
          eventType: "disconnected",
          eventTimestamp: STALE,
          disconnectReason: "CONNECTION_LOST",
        },
      ],
    });

    render(<GroupMonitoringContent />);

    // Tiles: rollup value; roster: member row linking to the device dashboard.
    expect(await screen.findByText("iot.groups.monitoring.onlineValue")).toBeInTheDocument();
    const memberLink = screen.getByRole("link", { name: "Gateway One" });
    expect(memberLink).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${gateway.deviceId}/monitoring`,
    );
    // Throughput: window total; event log: the disconnect with the member's name.
    expect(screen.getByText("iot.devices.monitoring.throughputTotal")).toBeInTheDocument();
    expect(screen.getByText("Gateway One · CONNECTION_LOST")).toBeInTheDocument();
    // A stale-but-connected member carries the silent flag in roster and tiles.
    expect(screen.getByText("iot.groups.monitoring.silentCount")).toBeInTheDocument();
    expect(screen.getAllByText("iot.devices.monitoring.connectedButSilent")).toHaveLength(1);
  });

  it("never judges silence when the pipeline is unavailable, and says why", async () => {
    mountMonitoring({
      members: [
        createDeviceGroupMemberHealth({
          name: "Gateway One",
          connectivity: { connected: true, lastSeenAt: null },
          lastDataAt: null,
        }),
      ],
      pipelineUnavailable: true,
    });

    render(<GroupMonitoringContent />);

    expect(
      await screen.findByText("iot.groups.monitoring.pipelineUnavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("shows the empty state for a memberless group", async () => {
    mountMonitoring({ members: [] });

    render(<GroupMonitoringContent />);

    expect(await screen.findByText("iot.groups.noMembers")).toBeInTheDocument();
  });

  it("offers a retry when the request fails", async () => {
    server.mount(contract.deviceGroups.getDeviceGroupMonitoring, { status: 500 });

    render(<GroupMonitoringContent />);

    expect(await screen.findByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.retry")).toBeInTheDocument();
  });
});
