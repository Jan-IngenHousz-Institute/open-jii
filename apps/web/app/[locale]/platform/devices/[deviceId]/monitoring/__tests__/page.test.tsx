import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import DeviceMonitoringContent from "../device-monitoring-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const EXPERIMENT_ID = "22222222-2222-4222-8222-222222222222";

const monitoring: DeviceMonitoring = {
  bucket: "hour",
  events: [
    {
      eventType: "connected",
      eventTimestamp: "2026-08-13T01:00:00.000Z",
      disconnectReason: null,
      sessionIdentifier: "s-1",
    },
    {
      eventType: "disconnected",
      eventTimestamp: "2026-08-13T03:00:00.000Z",
      disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
      sessionIdentifier: "s-1",
    },
  ],
  sessions: [
    {
      start: "2026-08-13T01:00:00.000Z",
      end: "2026-08-13T03:00:00.000Z",
      openStart: false,
      durationSeconds: 7200,
      disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
    },
  ],
  uptimePercent: 42.5,
  truncated: false,
  throughput: [{ bucketStart: "2026-08-13T01:00:00.000Z", experimentId: EXPERIMENT_ID, count: 12 }],
  battery: [{ bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 87.5 }],
  payload: {
    totalMeasurements: 12,
    withGps: 6,
    withBattery: 12,
    workbookRuns: 2,
    firmwareMix: [{ version: "1.1.0", count: 12 }],
    protocolMix: [],
    workbookMix: [],
    macroMix: [],
  },
  firmwareHistory: [],
  recentMeasurements: [],
};

function mountAll(overrides?: Partial<DeviceMonitoring>) {
  server.mount(contract.iot.getIotDevice, {
    body: createIotDeviceDetail({
      id: DEVICE_ID,
      connectivity: { connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" },
    }),
  });
  server.mount(contract.iot.getIotDeviceActivity, {
    body: { lastDataAt: new Date(Date.now() - 5 * 60_000).toISOString() },
  });
  server.mount(contract.iot.listDeviceExperiments, {
    body: [
      {
        id: EXPERIMENT_ID,
        name: "Soil Health",
        status: "active",
        addedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  });
  server.mount(contract.iot.getDeviceMonitoring, { body: { ...monitoring, ...overrides } });
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
});

describe("generateMetadata", () => {
  it("titles the route by its monitoring section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`monitoring:${DEVICE_ID}`);
  });
});

describe("DeviceMonitoringPage", () => {
  it("renders the full dashboard: tiles, uptime, throughput, experiments, payload, events", async () => {
    mountAll();

    render(<DeviceMonitoringContent />);

    expect(await screen.findByText("iot.devices.monitoring.availabilityTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.throughputTitle")).toBeInTheDocument();
    expect(screen.getByText("Soil Health")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.payloadTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.batteryTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.eventLogTitle")).toBeInTheDocument();
    // The outage behind the session is listed with the reason it ended.
    expect(screen.getAllByText("MQTT_KEEP_ALIVE_TIMEOUT").length).toBeGreaterThan(0);
  });

  it("hides the battery panel when the family never reports battery", async () => {
    mountAll({ battery: [] });

    render(<DeviceMonitoringContent />);

    await screen.findByText("iot.devices.monitoring.availabilityTitle");
    expect(screen.queryByText("iot.devices.monitoring.batteryTitle")).not.toBeInTheDocument();
  });

  it("shows unknown uptime and an empty event state for a silent range", async () => {
    mountAll({ events: [], sessions: [], uptimePercent: null });

    render(<DeviceMonitoringContent />);

    expect(
      (await screen.findAllByText("iot.devices.monitoring.uptimeUnknown")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("iot.devices.monitoring.noEvents").length).toBeGreaterThan(0);
  });

  it("shows a retry affordance when the warehouse query fails", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, connectivity: null }),
    });
    server.mount(contract.iot.getIotDeviceActivity, { body: { lastDataAt: null } });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    const spy = server.mount(contract.iot.getDeviceMonitoring, { status: 500 });

    render(<DeviceMonitoringContent />);

    expect(await screen.findByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    const attemptsBeforeRetry = spy.callCount;

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.retry" }));

    await waitFor(() => {
      expect(spy.callCount).toBeGreaterThan(attemptsBeforeRetry);
    });
  });

  it("re-queries the whole dashboard on one shared range, switching bucket with the span", async () => {
    mountAll();
    const spy = server.mount(contract.iot.getDeviceMonitoring, { body: monitoring });
    const user = userEvent.setup();

    render(<DeviceMonitoringContent />);
    await screen.findByText("iot.devices.monitoring.availabilityTitle");

    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.range.last7d" }));

    await waitFor(() => {
      // A week cannot be read on an hourly axis, so the grain follows the span.
      expect(spy.calls.at(-1)?.query.bucket).toBe("day");
    });
  });
});
