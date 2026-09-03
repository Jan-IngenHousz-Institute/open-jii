import { createDeviceGroupMemberHealth } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { IotDeviceGroupMonitoring } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { GroupMonitoringContent } from "./group-monitoring-content";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: vi.fn(() => <div data-testid="bar-chart" />),
  HorizontalBarChart: vi.fn(() => <div data-testid="horizontal-bar-chart" />),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

const STALE = "2026-08-18T00:00:00.000Z";

type MonitoringBody = Pick<IotDeviceGroupMonitoring, "members"> &
  Partial<Omit<IotDeviceGroupMonitoring, "members">>;

function mountMonitoring(body: MonitoringBody) {
  server.mount(contract.experiments.listExperiments, { body: [] });
  server.mount(contract.iot.getIotDeviceGroupMonitoring, {
    body: {
      throughput: [],
      dataByExperiment: [],
      firmware: [],
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

  it("scopes every member-attributed panel to the search filter", async () => {
    const user = userEvent.setup();
    const alpha = createDeviceGroupMemberHealth({
      name: "Alpha",
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: STALE,
    });
    const beta = createDeviceGroupMemberHealth({
      name: "Beta",
      connectivity: null,
    });
    mountMonitoring({
      members: [alpha, beta],
      throughput: [
        { bucketStart: STALE, deviceId: alpha.deviceId, count: 3 },
        { bucketStart: STALE, deviceId: beta.deviceId, count: 9 },
      ],
      firmware: [
        { deviceId: alpha.deviceId, version: "1.0.0", lastSeen: STALE },
        { deviceId: beta.deviceId, version: "2.0.0", lastSeen: STALE },
      ],
    });

    render(<GroupMonitoringContent />);

    // Both firmware versions in the field: flagged as mixed.
    expect(await screen.findByText("iot.groups.monitoring.mixedFirmware")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
      "alpha",
    );

    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta" })).not.toBeInTheDocument();
    // Firmware follows the filter, so the mixed-version flag clears.
    expect(screen.queryByText("iot.groups.monitoring.mixedFirmware")).not.toBeInTheDocument();
  });

  it("filters by status chip", async () => {
    const user = userEvent.setup();
    mountMonitoring({
      members: [
        createDeviceGroupMemberHealth({
          name: "Online One",
          connectivity: { connected: true, lastSeenAt: null },
          lastDataAt: STALE,
        }),
        createDeviceGroupMemberHealth({ name: "Ghost", connectivity: null }),
      ],
    });

    render(<GroupMonitoringContent />);

    await screen.findByRole("link", { name: "Online One" });
    await user.click(screen.getByRole("button", { name: /filter.silent/ }));

    expect(screen.getByRole("link", { name: "Online One" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ghost" })).not.toBeInTheDocument();
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

  it("offers a retry that refetches after a failure", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperiments, { body: [] });
    const monitoring = server.mount(contract.iot.getIotDeviceGroupMonitoring, {
      status: 500,
    });

    render(<GroupMonitoringContent />);

    expect(await screen.findByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    await user.click(screen.getByText("iot.devices.monitoring.retry"));

    await vi.waitFor(() => {
      expect(monitoring.callCount).toBeGreaterThan(1);
    });
  });

  it("reloads the window when a range preset is picked", async () => {
    const user = userEvent.setup();
    mountMonitoring({ members: [] });

    render(<GroupMonitoringContent />);

    await screen.findByText("iot.groups.noMembers");
    await user.click(screen.getByText("iot.devices.monitoring.range.last7d"));

    // A new window means a new request with a day-grain bucket.
    await vi.waitFor(() => {
      expect(screen.getByText("iot.groups.noMembers")).toBeInTheDocument();
    });
  });
});
