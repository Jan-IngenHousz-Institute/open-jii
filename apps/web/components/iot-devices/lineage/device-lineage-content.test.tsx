import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import DeviceLineageContent from "./device-lineage-content";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const BOUND_EXPERIMENT = "22222222-2222-4222-8222-222222222222";
const STRANGER_EXPERIMENT = "33333333-3333-4333-8333-333333333333";

const monitoring: DeviceMonitoring = {
  bucket: "day",
  events: [],
  sessions: [
    {
      start: "2026-08-13T01:00:00.000Z",
      end: "2026-08-13T03:00:00.000Z",
      openStart: false,
      durationSeconds: 7200,
      disconnectReason: null,
    },
  ],
  uptimePercent: 87.2,
  truncated: false,
  throughput: [
    { bucketStart: "2026-08-13T00:00:00.000Z", experimentId: BOUND_EXPERIMENT, count: 12 },
    { bucketStart: "2026-08-14T00:00:00.000Z", experimentId: STRANGER_EXPERIMENT, count: 3 },
  ],
  battery: [],
  payload: {
    totalMeasurements: 15,
    withGps: 6,
    withBattery: 12,
    workbookRuns: 2,
    firmwareMix: [],
    protocolMix: [{ protocolId: "44444444-4444-4444-8444-444444444444", count: 15 }],
    workbookMix: [],
    macroMix: [],
  },
  firmwareHistory: [{ version: "1.2.0", firstSeen: "a", lastSeen: "b", count: 15 }],
  recentMeasurements: [
    {
      timestamp: "2026-08-14T10:00:00.000Z",
      experimentId: BOUND_EXPERIMENT,
      protocolId: null,
      workbookVersionId: null,
      deviceVersion: "1.2.0",
      battery: null,
      latitude: null,
      longitude: null,
      sample: null,
    },
  ],
};

function mountAll(monitoringOverrides: Partial<DeviceMonitoring> = {}) {
  server.mount(contract.iot.getIotDevice, {
    body: createIotDeviceDetail({
      id: DEVICE_ID,
      name: "Gateway",
      thingName: "ambyte_GW-1",
      connectivity: { connected: true, lastSeenAt: "2026-08-14T08:00:00.000Z" },
    }),
  });
  server.mount(contract.iot.getIotDeviceActivity, {
    body: { lastDataAt: "2026-08-14T10:00:00.000Z", pipelineUnavailable: false },
  });
  server.mount(contract.iot.listDeviceExperiments, {
    body: [
      {
        id: BOUND_EXPERIMENT,
        name: "Soil Health",
        status: "active",
        addedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  });
  server.mount(contract.iot.getDeviceMonitoring, {
    body: { ...monitoring, ...monitoringOverrides },
  });
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
});

describe("DeviceLineageContent", () => {
  it("renders the identity chain through to the experiments", async () => {
    mountAll();

    render(<DeviceLineageContent />);

    expect(await screen.findByText("iot.devices.lineage.brokerTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.warehouseTitle")).toBeInTheDocument();
    expect(screen.getByText("ambyte_GW-1")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("Soil Health")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.legend.unbound")).toBeInTheDocument();
  });

  it("flags an arrival without a binding and keeps its experiment opaque", async () => {
    mountAll();

    render(<DeviceLineageContent />);

    await screen.findByText("iot.devices.lineage.brokerTitle");
    // The stranger experiment renders, but only as an unnamed placeholder.
    expect(screen.getByText("iot.devices.monitoring.privateExperiment")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.notBound")).toBeInTheDocument();
  });

  it("marks a bound experiment with no rows in range as silent", async () => {
    mountAll({ throughput: [] });

    render(<DeviceLineageContent />);

    await screen.findByText("iot.devices.lineage.brokerTitle");
    expect(screen.getByText("iot.devices.monitoring.boundButSilent")).toBeInTheDocument();
  });

  it("inspects an experiment node on click, including its recent measurements", async () => {
    mountAll();

    render(<DeviceLineageContent />);

    expect(await screen.findByText("iot.devices.lineage.inspectHint")).toBeInTheDocument();

    // fireEvent, not user-event: user-event's mousedown carries view: null,
    // which d3-zoom's pan handler cannot survive in jsdom; a plain click still
    // drives ReactFlow's node selection.
    fireEvent.click(screen.getByText("Soil Health"));

    expect(await screen.findByText("iot.devices.lineage.bindingLabel")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.bound")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.recentTitle")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.lineage.inspectHint")).not.toBeInTheDocument();
  });

  it("shows a retry affordance when the warehouse query fails", async () => {
    mountAll();
    server.mount(contract.iot.getDeviceMonitoring, { status: 500 });

    render(<DeviceLineageContent />);

    await waitFor(() => {
      expect(screen.getByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "iot.devices.monitoring.retry" }),
    ).toBeInTheDocument();
  });
});
