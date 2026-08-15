import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { PayloadProfile } from "./payload-profile";

const PROTOCOL_ID = "55555555-5555-4555-8555-555555555555";
const WORKBOOK_ID = "66666666-6666-4666-8666-666666666666";

function payload(overrides: Partial<DevicePayloadStats> = {}): DevicePayloadStats {
  return {
    totalMeasurements: 200,
    withGps: 50,
    withBattery: 200,
    workbookRuns: 2,
    firmwareMix: [{ version: "1.1.0", count: 200 }],
    protocolMix: [],
    workbookMix: [],
    ...overrides,
  };
}

function renderProfile(
  stats: DevicePayloadStats,
  visible: Partial<{
    protocols: { id: string; name: string }[];
    workbooks: { id: string; name: string }[];
  }> = {},
) {
  return render(
    <PayloadProfile
      payload={stats}
      visibleProtocols={visible.protocols ?? []}
      visibleWorkbooks={visible.workbooks ?? []}
      locale="en-US"
    />,
  );
}

describe("PayloadProfile", () => {
  it("reads coverage as a share of the measurements sent", () => {
    renderProfile(payload());

    expect(screen.getByText("25% (50/200)")).toBeInTheDocument();
    expect(screen.getByText("100% (200/200)")).toBeInTheDocument();
  });

  it("labels the firmware breakdown as device-reported", () => {
    renderProfile(payload());

    expect(screen.getByText("iot.devices.monitoring.firmwareVersions")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.asReported")).toBeInTheDocument();
    expect(screen.getByText("1.1.0")).toBeInTheDocument();
  });

  it("names and links a protocol the viewer can open", () => {
    renderProfile(payload({ protocolMix: [{ protocolId: PROTOCOL_ID, count: 200 }] }), {
      protocols: [{ id: PROTOCOL_ID, name: "Soil moisture v2" }],
    });

    expect(screen.getByRole("link", { name: /Soil moisture v2/ })).toHaveAttribute(
      "href",
      `/en-US/platform/protocols/${PROTOCOL_ID}`,
    );
  });

  it("withholds the identity of a protocol the viewer cannot open", () => {
    renderProfile(payload({ protocolMix: [{ protocolId: PROTOCOL_ID, count: 200 }] }));

    expect(screen.queryByText(PROTOCOL_ID)).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.privateProtocol")).toBeInTheDocument();
  });

  it("calls out measurements sent outside any workbook", () => {
    renderProfile(payload({ workbookMix: [{ workbookVersionId: null, count: 200 }] }));

    expect(screen.getByText("iot.devices.monitoring.noWorkbook")).toBeInTheDocument();
  });

  it("names and links a workbook the viewer can open", () => {
    renderProfile(payload({ workbookMix: [{ workbookVersionId: WORKBOOK_ID, count: 200 }] }), {
      workbooks: [{ id: WORKBOOK_ID, name: "Field routine" }],
    });

    expect(screen.getByRole("link", { name: /Field routine/ })).toBeInTheDocument();
  });

  it("says so plainly when the device sent nothing", () => {
    renderProfile(payload({ totalMeasurements: 0 }));

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
  });
});
