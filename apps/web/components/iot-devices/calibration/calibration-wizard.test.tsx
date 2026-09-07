import { useIotConnections } from "@/hooks/iot/useIotConnections/useIotConnections";
import {
  createCalibrationDefinition,
  createCalibrationDefinitionSummary,
  createCalibrationRun,
  createDeviceCalibration,
  createIotDeviceDetail,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ITransportAdapter } from "@repo/iot";
import { MiniParDriver } from "@repo/iot";

import { CalibrationWizard } from "./calibration-wizard";

vi.mock("@/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: vi.fn(),
}));

// Plotly has no business in jsdom; the review test covers the chart's inputs.
vi.mock("@/components/iot-devices/calibration/calibration-fit-chart", () => ({
  CalibrationFitChart: () => <div data-testid="fit-chart" />,
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

/**
 * A MiniPAR console: `par_raw` answers a reading, calibration writers echo
 * the value. Every line the wizard sends is kept so the test can assert the
 * exact console traffic a bench session produces.
 */
function miniparConsole(readings: number[]) {
  const sent: string[] = [];
  const queue = [...readings];
  let deliver: ((data: string) => void) | undefined;

  const transport: ITransportAdapter = {
    isConnected: () => true,
    send: (payload) => {
      const line = payload.trim();
      sent.push(line);
      const [command, value] = line.split(",");
      const reply =
        command === "par_raw"
          ? `\n${(queue.shift() ?? 0).toFixed(2)}\n`
          : command.startsWith("cal_par_")
            ? `\n${value}\n`
            : "\n";
      setTimeout(() => deliver?.(reply), 0);
      return Promise.resolve();
    },
    onDataReceived: (callback) => {
      deliver = callback;
    },
    onStatusChanged: () => undefined,
    disconnect: () => Promise.resolve(),
  };

  return { transport, sent };
}

const DEFINITION = createCalibrationDefinition({ id: DEFINITION_ID, family: "minipar" });

describe("CalibrationWizard", () => {
  beforeEach(() => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ id: DEFINITION_ID, family: "minipar" })],
    });
    server.mount(contract.iot.getCalibrationDefinition, { body: DEFINITION });
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
  });

  it("runs the manual MiniPAR procedure from choosing it to a confirmed write", async () => {
    const console = miniparConsole([420, 150, 8.33]);
    const driver = new MiniParDriver({ timeoutMs: 500, protocolTimeoutMs: 500 });
    driver.initialize(console.transport);

    vi.mocked(useIotConnections).mockReturnValue({
      connections: [
        {
          id: "conn-1",
          label: "MiniPAR",
          ordinal: 1,
          family: "minipar",
          identity: { family: "minipar", name: "MiniPAR", firmwareVersion: "1.03", raw: {} },
          driver,
        },
      ],
      isConnecting: false,
      error: null,
      connect: vi.fn(() => Promise.resolve()),
      disconnectDevice: vi.fn(() => Promise.resolve()),
      disconnectAll: vi.fn(() => Promise.resolve()),
    });

    const createSpy = server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });
    const applied = createDeviceCalibration({ deviceId: DEVICE_ID });
    server.mount(contract.iot.approveCalibrationRun, { status: 201, body: applied });
    const reportSpy = server.mount(contract.iot.reportDeviceCalibrationWrite, {
      body: { ...applied, writtenToDeviceAt: "2026-09-01T10:06:00.000Z" },
    });

    const onClose = vi.fn();
    render(
      <CalibrationWizard
        device={createIotDeviceDetail({ id: DEVICE_ID, deviceType: "minipar" })}
        family="minipar"
        onClose={onClose}
      />,
    );

    // Choose the procedure.
    await userEvent.click(await screen.findByRole("radio"));
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

    // The device is already on the page; move on.
    expect(await screen.findByText("iot.calibration.connect.connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

    // Three light levels: acknowledge the instruction, then type the reference.
    for (const reference of ["402.12", "142.92", "6.92"]) {
      await userEvent.click(
        await screen.findByRole("button", { name: "iot.calibration.prompt.continue" }),
      );
      await userEvent.type(await screen.findByRole("textbox"), reference);
      await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));
    }

    // Review what came back and approve it.
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.review.approve" }),
    );

    // Write it to the device.
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.write.action" }),
    );
    expect(await screen.findByText("iot.calibration.write.verified")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));

    await waitFor(() => {
      expect(screen.getByText("iot.calibration.done.writtenHint")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));
    expect(onClose).toHaveBeenCalled();

    // The submission carried the three captured rows and the device's version.
    expect(createSpy.params.deviceId).toBe(DEVICE_ID);
    expect(reportSpy.called).toBe(true);

    // The console saw three raw reads and both coefficient writers, in order.
    expect(console.sent).toEqual([
      "par_raw",
      "par_raw",
      "par_raw",
      "cal_par_slope,0.96",
      "cal_par_intercept,-1.08",
    ]);
  });

  it("stops with the reason when the operator declines a required step", async () => {
    const console = miniparConsole([420]);
    const driver = new MiniParDriver({ timeoutMs: 500, protocolTimeoutMs: 500 });
    driver.initialize(console.transport);
    vi.mocked(useIotConnections).mockReturnValue({
      connections: [
        {
          id: "conn-1",
          label: "MiniPAR",
          family: "minipar",
          identity: { family: "minipar", raw: {} },
          driver,
        },
      ],
      isConnecting: false,
      error: null,
      connect: vi.fn(() => Promise.resolve()),
      disconnectDevice: vi.fn(() => Promise.resolve()),
      disconnectAll: vi.fn(() => Promise.resolve()),
    });
    const createSpy = server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun(),
    });

    render(
      <CalibrationWizard
        device={createIotDeviceDetail({ id: DEVICE_ID, deviceType: "minipar" })}
        family="minipar"
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("radio"));
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));
    await screen.findByText("iot.calibration.connect.connected");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.prompt.decline" }),
    );

    expect(await screen.findByText("iot.calibration.capture.aborted")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.calibration.capture.retry" }),
    ).toBeInTheDocument();
    expect(createSpy.called).toBe(false);
    expect(console.sent).toEqual([]);

    // Retrying stays on the capture step, so it has to start the procedure
    // itself: the first prompt comes back and the device is read again.
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.capture.retry" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.prompt.continue" }),
    );
    await userEvent.type(await screen.findByRole("textbox"), "402.12");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));

    await waitFor(() => {
      expect(console.sent).toEqual(["par_raw"]);
    });
    expect(screen.queryByText("iot.calibration.capture.aborted")).toBeNull();
  });
});
