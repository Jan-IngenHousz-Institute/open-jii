import { createCalibrationDefinitionDetail, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
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
  });

  // A procedure runs against the family it was written for; offering the rest invites a
  // session that the platform refuses once the device answers.
  it("offers only the devices this procedure could run against", async () => {
    server.mount(contract.iot.listIotDevices, { body: devices });

    render(<CalibrationRunContent />);

    expect(await screen.findByText("Bench MiniPAR")).toBeInTheDocument();
    expect(screen.queryByText("Field Ambit")).toBeNull();
  });

  it("opens the bench on the procedure already chosen", async () => {
    server.mount(contract.iot.listIotDevices, { body: devices });

    render(<CalibrationRunContent />);
    await userEvent.click(await screen.findByLabelText(/Bench MiniPAR/));

    // Straight to Connect: the procedure is not something to pick here.
    expect(await screen.findByText("iot.calibration.connect.hint")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.choose.hint")).toBeNull();
  });

  it("says so when nothing of this family is registered", async () => {
    server.mount(contract.iot.listIotDevices, { body: [devices[1]] });

    render(<CalibrationRunContent />);

    expect(await screen.findByText("iot.calibration.trial.noDevices")).toBeInTheDocument();
  });
});
