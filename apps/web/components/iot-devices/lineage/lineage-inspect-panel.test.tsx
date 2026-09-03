import { createIotDeviceDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import type { LineageNodeModel } from "./build-device-lineage";
import { LineageInspectPanel } from "./lineage-inspect-panel";

const EXPERIMENT_ID = "22222222-2222-4222-8222-222222222222";

const monitoring: DeviceMonitoring = {
  bucket: "day",
  events: [],
  sessions: [],
  uptimePercent: null,
  truncated: false,
  throughput: [],
  battery: [],
  payload: {
    totalMeasurements: 15,
    withGps: 6,
    withBattery: 12,
    workbookRuns: 2,
    firmwareMix: [],
    protocolMix: [],
    workbookMix: [],
    macroMix: [],
  },
  firmwareHistory: [],
  recentMeasurements: [
    {
      timestamp: "2026-08-14T10:00:00.000Z",
      experimentId: EXPERIMENT_ID,
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

const device = createIotDeviceDetail({
  thingName: "ambyte_GW-1",
  serialNumber: "SN-77",
  certificateId: "cert-x",
});

function renderPanel(selected: LineageNodeModel | null) {
  return render(
    <LineageInspectPanel selected={selected} device={device} monitoring={monitoring} />,
  );
}

describe("LineageInspectPanel", () => {
  it("prompts for a selection when nothing is selected", () => {
    renderPanel(null);

    expect(screen.getByText("iot.devices.lineage.inspectHint")).toBeInTheDocument();
  });

  it("shows the device identity facts", () => {
    renderPanel({
      id: "device",
      kind: "device",
      label: "Gateway",
      family: "ambyte",
      status: "active",
      firmwareVersion: "1.2.0",
    });

    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("ambyte_GW-1")).toBeInTheDocument();
    expect(screen.getByText("SN-77")).toBeInTheDocument();
    expect(screen.getByText("cert-x")).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
  });

  it("shows the broker identity with uptime and sessions", () => {
    renderPanel({
      id: "broker",
      kind: "broker",
      thingName: "ambyte_GW-1",
      connectivity: { connected: true, lastSeenAt: null },
      uptimePercent: 87.2,
      sessionCount: 3,
    });

    expect(screen.getByText("iot.devices.lineage.brokerHint")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the warehouse totals", () => {
    renderPanel({
      id: "warehouse",
      kind: "warehouse",
      totalMeasurements: 15,
      lastDataAt: null,
      withGps: 6,
      withBattery: 12,
      workbookRuns: 2,
    });

    expect(screen.getByText("iot.devices.lineage.warehouseHint")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.noData")).toBeInTheDocument();
  });

  it("shows an experiment's recent measurements and binding state", () => {
    renderPanel({
      id: `experiment:${EXPERIMENT_ID}`,
      kind: "experiment",
      entity: {
        id: EXPERIMENT_ID,
        label: "Soil Health",
        href: `/en-US/platform/experiments/${EXPERIMENT_ID}/data`,
        accessible: true,
      },
      count: 12,
      lastBucketAt: "2026-08-14T00:00:00.000Z",
      bound: true,
    });

    expect(screen.getByRole("link", { name: /Soil Health/ })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.bound")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.lineage.recentTitle")).toBeInTheDocument();
  });

  it("explains unattributed rows", () => {
    renderPanel({ id: "unattributed", kind: "unattributed", count: 10 });

    expect(screen.getByText("iot.devices.lineage.unattributedHint")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows an attribution entity with its caption and link state", () => {
    renderPanel({
      id: "protocol:p-1",
      kind: "protocol",
      entity: { id: "p-1", label: "PAR burst", href: null, accessible: false },
      count: 15,
    });

    expect(screen.getByText("iot.devices.lineage.protocolCaption")).toBeInTheDocument();
    // Inaccessible entities render as muted text, never a link.
    expect(screen.getAllByText("PAR burst").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("summarizes a folded attribution remainder", () => {
    renderPanel({
      id: "protocol:other",
      kind: "attribution-other",
      attributionKind: "protocol",
      folded: 2,
      count: 13,
    });

    expect(screen.getByText("iot.devices.lineage.otherTitle")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });
});
