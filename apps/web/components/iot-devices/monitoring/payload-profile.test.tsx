import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { PayloadProfile } from "./payload-profile";

const PROTOCOL_ID = "55555555-5555-4555-8555-555555555555";
const WORKBOOK_ID = "66666666-6666-4666-8666-666666666666";
// Deliberately different from WORKBOOK_ID: conflating the two is the bug these
// tests exist to catch.
const WORKBOOK_VERSION_ID = "77777777-7777-4777-8777-777777777777";
const MACRO_ID = "77777777-7777-4777-8777-777777777777";

function payload(overrides: Partial<DevicePayloadStats> = {}): DevicePayloadStats {
  return {
    totalMeasurements: 200,
    withGps: 50,
    withBattery: 200,
    workbookRuns: 2,
    firmwareMix: [{ version: "1.1.0", count: 200 }],
    protocolMix: [],
    workbookMix: [],
    macroMix: [],
    ...overrides,
  };
}

function renderProfile(
  stats: DevicePayloadStats,
  visible: Partial<{
    protocols: { id: string; name: string }[];
    workbooks: { id: string; name: string }[];
    macros: { id: string; name: string }[];
  }> = {},
) {
  return render(
    <PayloadProfile
      payload={stats}
      visibleProtocols={visible.protocols ?? []}
      visibleWorkbooks={visible.workbooks ?? []}
      visibleMacros={visible.macros ?? []}
      locale="en-US"
    />,
  );
}

describe("PayloadProfile", () => {
  it("reads coverage as a share of the measurements sent", () => {
    renderProfile(payload());

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("50 / 200")).toBeInTheDocument();
    expect(screen.getByText("200 / 200")).toBeInTheDocument();
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

  it("calls an unresolvable protocol unknown and still shows the id the device sent", () => {
    renderProfile(payload({ protocolMix: [{ protocolId: "1234", count: 200 }] }));

    // Protocols are not access-controlled: an id the platform cannot resolve
    // simply is not defined here.
    expect(screen.getByText("iot.devices.monitoring.unknownProtocolId")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("calls out measurements sent outside any workbook", () => {
    renderProfile(
      payload({
        workbookMix: [
          { workbookVersionId: null, workbookId: null, workbookVersion: null, count: 200 },
        ],
      }),
    );

    expect(screen.getByText("iot.devices.monitoring.noWorkbook")).toBeInTheDocument();
  });

  it("names and links the workbook that owns the reported version", () => {
    renderProfile(
      payload({
        workbookMix: [
          {
            workbookVersionId: WORKBOOK_VERSION_ID,
            workbookId: WORKBOOK_ID,
            workbookVersion: 3,
            count: 200,
          },
        ],
      }),
      { workbooks: [{ id: WORKBOOK_ID, name: "Field routine" }] },
    );

    // Attribution runs through the owning workbook: the version id the device
    // reported matches nothing the viewer can list.
    expect(screen.getByRole("link", { name: /Field routine/ })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.workbookVersionShort")).toBeInTheDocument();
  });

  it("marks a reported version the registry does not know", () => {
    renderProfile(
      payload({
        workbookMix: [
          {
            workbookVersionId: WORKBOOK_VERSION_ID,
            workbookId: null,
            workbookVersion: null,
            count: 200,
          },
        ],
      }),
      { workbooks: [{ id: WORKBOOK_ID, name: "Field routine" }] },
    );

    expect(screen.getByText("iot.devices.monitoring.unknownWorkbookId")).toBeInTheDocument();
  });

  it("names and links a macro the viewer can open", () => {
    renderProfile(payload({ macroMix: [{ macroId: MACRO_ID, count: 120 }] }), {
      macros: [{ id: MACRO_ID, name: "Fluorescence QC" }],
    });

    expect(screen.getByRole("link", { name: /Fluorescence QC/ })).toHaveAttribute(
      "href",
      `/en-US/platform/macros/${MACRO_ID}`,
    );
  });

  it("counts macro runs against the macro total, not the measurement total", () => {
    // Two macros on every one of the 200 measurements: each ran on all of
    // them, so each reads 50% of the macro runs rather than 100% of the
    // measurements.
    renderProfile(
      payload({
        macroMix: [
          { macroId: MACRO_ID, count: 200 },
          { macroId: "abcd", count: 200 },
        ],
      }),
    );

    expect(screen.getAllByText("50%")).toHaveLength(2);
  });

  it("calls a macro the platform does not define unknown", () => {
    renderProfile(payload({ macroMix: [{ macroId: "9999", count: 10 }] }));

    expect(screen.getByText("iot.devices.monitoring.unknownMacroId")).toBeInTheDocument();
    expect(screen.getByText("9999")).toBeInTheDocument();
  });

  it("says so plainly when the device sent nothing", () => {
    renderProfile(payload({ totalMeasurements: 0 }));

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
  });
});
