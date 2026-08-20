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
      serialNumber: "SN-77",
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

  it("renders unattributed rows and folds attribution past the cap", async () => {
    mountAll({
      throughput: [
        { bucketStart: "2026-08-13T00:00:00.000Z", experimentId: BOUND_EXPERIMENT, count: 12 },
        { bucketStart: "2026-08-14T00:00:00.000Z", experimentId: null, count: 4 },
      ],
      payload: {
        ...monitoring.payload,
        protocolMix: Array.from({ length: 5 }, (_, index) => ({
          protocolId: `4444444${String(index)}-4444-4444-8444-444444444444`,
          count: 10 - index,
        })),
        workbookMix: [{ workbookVersionId: "55555555-5555-4555-8555-555555555555", count: 2 }],
        macroMix: [{ macroId: "66666666-6666-4666-8666-666666666666", count: 1 }],
      },
    });

    render(<DeviceLineageContent />);

    expect(await screen.findByText("iot.devices.lineage.unattributedTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.otherTitle")).toBeInTheDocument();
    expect(screen.getByText(/lineage.workbookCaption/)).toBeInTheDocument();
    expect(screen.getByText(/lineage.macroCaption/)).toBeInTheDocument();
  });

  it("inspects the device node and deselects on a pane click", async () => {
    mountAll();

    const { container } = render(<DeviceLineageContent />);

    fireEvent.click(await screen.findByText("Gateway"));
    expect(await screen.findByText("SN-77")).toBeInTheDocument();

    const pane = container.querySelector(".react-flow__pane");
    expect(pane).not.toBeNull();
    if (pane !== null) {
      fireEvent.click(pane);
    }
    expect(await screen.findByText("iot.devices.lineage.inspectHint")).toBeInTheDocument();
  });

  it("refetches a narrower window when a preset changes", async () => {
    mountAll();
    const spy = server.mount(contract.iot.getDeviceMonitoring, { body: monitoring });

    render(<DeviceLineageContent />);
    await screen.findByText("iot.devices.lineage.brokerTitle");
    const beforeClick = spy.calls.length;
    const defaultFrom = spy.calls[beforeClick - 1].query.from;

    fireEvent.click(screen.getByRole("button", { name: "iot.devices.monitoring.range.last24h" }));

    await waitFor(() => {
      expect(spy.calls.length).toBeGreaterThan(beforeClick);
    });
    // The 24h preset starts later than the 30d default, so the refetch really
    // carries the new window rather than repeating the old one.
    expect(spy.calls[spy.calls.length - 1].query.from > defaultFrom).toBe(true);
  });

  it("keeps the inspect panel on the refreshed node after a background refetch", async () => {
    mountAll();

    render(<DeviceLineageContent />);

    fireEvent.click(await screen.findByText("Soil Health"));
    expect(await screen.findByText("12")).toBeInTheDocument();

    // A focus refetch rebuilds the model; the panel must follow the fresh node
    // rather than the snapshot taken when it was clicked.
    server.mount(contract.iot.getDeviceMonitoring, {
      body: {
        ...monitoring,
        throughput: [
          { bucketStart: "2026-08-13T00:00:00.000Z", experimentId: BOUND_EXPERIMENT, count: 99 },
        ],
      },
    });
    fireEvent(window, new Event("visibilitychange"));

    expect(await screen.findByText("99")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.bindingLabel")).toBeInTheDocument();
  });

  it("recovers the graph through the retry affordance after a warehouse failure", async () => {
    mountAll();
    server.mount(contract.iot.getDeviceMonitoring, { status: 500 });

    render(<DeviceLineageContent />);

    await waitFor(() => {
      expect(screen.getByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    });

    server.mount(contract.iot.getDeviceMonitoring, { body: monitoring });
    fireEvent.click(screen.getByRole("button", { name: "iot.devices.monitoring.retry" }));

    expect(await screen.findByText("iot.devices.lineage.brokerTitle")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.loadError")).not.toBeInTheDocument();
  });

  it("surfaces a device-query failure instead of an eternal skeleton", async () => {
    mountAll();
    server.mount(contract.iot.getIotDevice, { status: 500 });

    render(<DeviceLineageContent />);

    await waitFor(() => {
      expect(screen.getByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    });
  });
});
