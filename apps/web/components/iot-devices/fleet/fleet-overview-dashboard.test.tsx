import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { IotFleetMonitoring } from "@repo/api/domains/iot/iot.schema";

import { FleetOverviewDashboard } from "./fleet-overview-dashboard";

const ONLINE_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";

const devices = [
  createIotDevice({
    id: ONLINE_ID,
    name: "Greenhouse gateway",
    status: "active",
    connectivity: { connected: true, lastSeenAt: "2026-08-24T10:00:00.000Z" },
  }),
  createIotDevice({
    id: PENDING_ID,
    name: "Bench unit",
    status: "pending",
    connectivity: { connected: false, lastSeenAt: null },
  }),
];

const monitoring: IotFleetMonitoring = {
  devices: [
    { deviceId: ONLINE_ID, lastDataAt: "2026-08-24T09:00:00.000Z" },
    { deviceId: PENDING_ID, lastDataAt: null },
  ],
  throughput: [
    { bucketStart: "2026-08-24T08:00:00.000Z", deviceId: ONLINE_ID, count: 12 },
    { bucketStart: "2026-08-24T09:00:00.000Z", deviceId: ONLINE_ID, count: 30 },
  ],
  events: [
    {
      deviceId: ONLINE_ID,
      eventType: "connected",
      eventTimestamp: "2026-08-24T08:00:00.000Z",
      disconnectReason: null,
    },
  ],
  pipelineUnavailable: false,
};

function mountAll(monitoringOverrides: Partial<IotFleetMonitoring> = {}) {
  server.mount(contract.iot.listIotDevices, { body: devices });
  return server.mount(contract.iot.getIotFleetMonitoring, {
    body: { ...monitoring, ...monitoringOverrides },
  });
}

describe("FleetOverviewDashboard", () => {
  it("reads the fleet at a glance: online count, freshest data, volume and stuck devices", async () => {
    mountAll();

    render(<FleetOverviewDashboard />);

    expect(await screen.findByText("iot.groups.monitoring.onlineValue")).toBeInTheDocument();
    // 12 + 30 measurements in range.
    expect(await screen.findByText("42")).toBeInTheDocument();
    // The pending device is the one attention entry, counted and listed.
    expect(await screen.findByText("iot.devices.fleet.reasonCredentials")).toBeInTheDocument();
    expect(screen.getByText("Bench unit")).toBeInTheDocument();
  });

  it("renders nothing over an empty registry, whose empty state owns the page", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });
    const spy = server.mount(contract.iot.getIotFleetMonitoring, { body: monitoring });

    const { container } = render(<FleetOverviewDashboard />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(spy.calls.length).toBe(0);
  });

  it("links each stuck device at the tab where the fix lives", async () => {
    mountAll();

    render(<FleetOverviewDashboard />);

    const row = await screen.findByRole("link", { name: /Bench unit/ });
    expect(row).toHaveAttribute("href", `/en-US/platform/devices/${PENDING_ID}/credentials`);
  });

  it("recovers the warehouse panels through the retry affordance", async () => {
    server.mount(contract.iot.listIotDevices, { body: devices });
    server.mount(contract.iot.getIotFleetMonitoring, { status: 500 });

    render(<FleetOverviewDashboard />);

    expect(await screen.findByText("iot.devices.fleet.loadError")).toBeInTheDocument();

    server.mount(contract.iot.getIotFleetMonitoring, { body: monitoring });
    fireEvent.click(screen.getByRole("button", { name: "iot.onboarding.retry" }));

    expect(await screen.findByText("iot.devices.fleet.throughputTitle")).toBeInTheDocument();
  });

  it("refetches a narrower window when a preset changes", async () => {
    const spy = mountAll();

    render(<FleetOverviewDashboard />);
    await screen.findByText("iot.devices.fleet.throughputTitle");
    const beforeClick = spy.calls.length;
    const defaultFrom = spy.calls[beforeClick - 1].query.from;

    fireEvent.click(screen.getByRole("button", { name: "iot.devices.monitoring.range.last7d" }));

    await waitFor(() => {
      expect(spy.calls.length).toBeGreaterThan(beforeClick);
    });
    // The 24h default starts later than the 7d window it widens to.
    expect(spy.calls[spy.calls.length - 1].query.from < defaultFrom).toBe(true);
  });

  it("never claims silence while the warehouse is unavailable", async () => {
    mountAll({ pipelineUnavailable: true, devices: [], throughput: [], events: [] });

    render(<FleetOverviewDashboard />);

    expect(
      await screen.findByText("iot.devices.monitoring.lastDataUnavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("iot.groups.monitoring.silentCount")).not.toBeInTheDocument();
  });
});
