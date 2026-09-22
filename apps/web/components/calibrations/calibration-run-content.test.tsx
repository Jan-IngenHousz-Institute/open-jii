import { createCalibrationDefinitionDetail, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { CalibrationRunContent } from "./calibration-run-content";

const definition = createCalibrationDefinitionDetail({ name: "PAR bench", family: "minipar" });

const devices = [
  createIotDevice({ name: "Bench MiniPAR", deviceType: "minipar" }),
  createIotDevice({ name: "Field Ambit", deviceType: "ambit" }),
];

describe("CalibrationRunContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ locale: "en-US", definitionId: definition.id });
    server.mount(contract.iot.getCalibrationDefinition, { body: definition });
    server.mount(contract.iot.listIotDevices, { body: devices });
  });

  // The unit announces itself when the port opens. Being asked to name it first was both a
  // step and a way to record a run against hardware that was never on the bench.
  it("opens on connect rather than asking which device this is", async () => {
    render(<CalibrationRunContent />);

    expect(await screen.findByText("iot.calibration.connect.hint")).toBeInTheDocument();
    expect(screen.queryByText("Bench MiniPAR")).toBeNull();
    expect(screen.queryByText("Field Ambit")).toBeNull();
  });

  it("carries the procedure in, so nothing is chosen twice", async () => {
    render(<CalibrationRunContent />);

    await screen.findByText("iot.calibration.connect.hint");
    expect(screen.queryByText("iot.calibration.choose.hint")).toBeNull();
  });
});
