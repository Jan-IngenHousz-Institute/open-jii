import {
  createCalibrationDefinition,
  createCalibrationRunDetail,
  createDeviceCalibration,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { CalibrationRunDetail } from "./calibration-run-detail";

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderDetail(onBack = vi.fn()) {
  render(<CalibrationRunDetail runId={RUN_ID} deviceId={DEVICE_ID} onBack={onBack} />);
  return onBack;
}

describe("CalibrationRunDetail", () => {
  beforeEach(() => {
    server.mount(contract.iot.getCalibrationRun, {
      body: createCalibrationRunDetail({ id: RUN_ID, deviceId: DEVICE_ID }),
    });
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinition({ name: "MiniPAR bench" }),
    });
    server.mount(contract.iot.listDeviceCalibrations, { body: [] });
  });

  it("shows the procedure, the coefficients and the readings the fit came from", async () => {
    renderDetail();

    expect(await screen.findByText("MiniPAR bench v1")).toBeInTheDocument();
    expect(await screen.findByText("0.96")).toBeInTheDocument();
    // The captured points, not just the fitted line.
    expect(await screen.findByText("209.5")).toBeInTheDocument();
    expect(screen.getByText("626.2")).toBeInTheDocument();
    // What this run replaced is not what the device holds today, so no coefficient is
    // shown as a change from anything.
    expect(screen.queryByText("iot.calibration.review.previousUnknown")).toBeNull();
  });

  // Approval and the write are separate events; a run can be approved on record with
  // nothing on the hardware.
  it("says so when approved coefficients never reached the device", async () => {
    server.mount(contract.iot.listDeviceCalibrations, {
      body: [createDeviceCalibration({ runId: RUN_ID, writtenToDeviceAt: null })],
    });

    renderDetail();

    expect(await screen.findByText("iot.calibration.run.writeNever")).toBeInTheDocument();
  });

  it("shows the write outcome and the check that followed it", async () => {
    server.mount(contract.iot.listDeviceCalibrations, {
      body: [
        createDeviceCalibration({
          runId: RUN_ID,
          writtenToDeviceAt: "2026-09-01T10:06:00.000Z",
          writeResults: { par: { verified: true } },
          verification: { par_check: [{ par: 200.4, par_ref: 200 }] },
        }),
      ],
    });

    renderDetail();

    expect(await screen.findByText("iot.calibration.write.verified")).toBeInTheDocument();
    expect(await screen.findByText("200.4")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.run.writeNever")).toBeNull();
  });

  // The device carries every calibration it has ever had; only this run's own write
  // says anything about this run.
  it("ignores a write that belongs to another session", async () => {
    server.mount(contract.iot.listDeviceCalibrations, {
      body: [
        createDeviceCalibration({
          runId: "33333333-3333-4333-8333-333333333333",
          writtenToDeviceAt: "2026-09-02T10:06:00.000Z",
          writeResults: { par: { verified: true } },
        }),
      ],
    });

    renderDetail();

    expect(await screen.findByText("MiniPAR bench v1")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.write.verified")).toBeNull();
    expect(screen.queryByText("iot.calibration.run.writeTitle")).toBeNull();
  });

  // Merging the two would let the state after the write hide what the device reported
  // before it, which is the pair a reviewer compares.
  it("keeps the device state before the session apart from the state after it", async () => {
    server.mount(contract.iot.getCalibrationRun, {
      body: createCalibrationRunDetail({
        id: RUN_ID,
        deviceId: DEVICE_ID,
        preInfo: { cal_par_slope: 1.234 },
        postInfo: { cal_par_slope: 5.678 },
      }),
    });

    renderDetail();

    expect(await screen.findByText("iot.calibration.run.infoBefore")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.run.infoAfter")).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(screen.getByText("5.678")).toBeInTheDocument();
  });

  it("returns to the list", async () => {
    const onBack = renderDetail();

    await userEvent.click(await screen.findByRole("button", { name: "iot.calibration.run.back" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("reports a session it could not load", async () => {
    server.mount(contract.iot.getCalibrationRun, { status: 500 });

    renderDetail();

    expect(await screen.findByText("iot.calibration.loadError")).toBeInTheDocument();
  });
});
