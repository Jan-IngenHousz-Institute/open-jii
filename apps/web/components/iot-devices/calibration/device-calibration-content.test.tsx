import {
  createCalibrationDefinitionSummary,
  createCalibrationRun,
  createCapabilities,
  createDeviceCalibration,
  createIotDeviceDetail,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceCalibrationContent from "./device-calibration-content";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function mountDevice(overrides: Parameters<typeof createIotDeviceDetail>[0] = {}) {
  server.mount(contract.iot.getIotDevice, {
    body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "minipar", ...overrides }),
  });
}

describe("DeviceCalibrationContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ family: "minipar" })],
    });
  });

  it("shows the calibration in force and the sessions on record", async () => {
    mountDevice();
    server.mount(contract.iot.getActiveDeviceCalibration, {
      body: createDeviceCalibration({ deviceId: DEVICE_ID }),
    });
    server.mount(contract.iot.listDeviceCalibrationRuns, {
      body: [createCalibrationRun({ deviceId: DEVICE_ID, status: "approved" })],
    });

    render(<DeviceCalibrationContent />);

    expect(await screen.findByText("0.96")).toBeInTheDocument();
    expect(await screen.findByText("iot.calibration.status.approved")).toBeInTheDocument();
  });

  it("shows a failed session's error and a load failure of the list", async () => {
    mountDevice();
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
    server.mount(contract.iot.listDeviceCalibrationRuns, {
      body: [
        createCalibrationRun({
          status: "compute_failed",
          errorMessage: "Coefficient 'par.slope' is above the allowed maximum",
        }),
      ],
    });

    const { unmount } = render(<DeviceCalibrationContent />);
    expect(await screen.findByText(/above the allowed maximum/)).toBeInTheDocument();
    unmount();

    server.mount(contract.iot.listDeviceCalibrationRuns, { status: 500 });
    render(<DeviceCalibrationContent />);
    expect(await screen.findByText("iot.calibration.loadError")).toBeInTheDocument();
  });

  it("opens the wizard from the call to action for a manager", async () => {
    mountDevice({ capabilities: createCapabilities({ canManage: true }) });
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
    server.mount(contract.iot.listDeviceCalibrationRuns, { body: [] });

    render(<DeviceCalibrationContent />);

    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.cta.calibrate" }),
    );

    expect(await screen.findByText("iot.calibration.choose.hint")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.cta.calibrate" })).toBeNull();
  });

  it("offers no call to action without manage rights", async () => {
    mountDevice({ capabilities: createCapabilities({ canManage: false }) });
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
    server.mount(contract.iot.listDeviceCalibrationRuns, { body: [] });

    render(<DeviceCalibrationContent />);

    expect(await screen.findByText("iot.calibration.active.none")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.cta.calibrate" })).toBeNull();
  });

  // A phone or an edge device has no coefficients; a direct visit leaves.
  it("leaves the route for a family that cannot be calibrated", async () => {
    mountDevice({ deviceType: "mobile" });
    const router = useRouter();

    render(<DeviceCalibrationContent />);

    await vi.waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`);
    });
  });
});
