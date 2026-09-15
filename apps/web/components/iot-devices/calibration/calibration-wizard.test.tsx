import { useIotConnections } from "@/hooks/iot/useIotConnections/useIotConnections";
import { referencePort, supplyPort } from "@/test/bench-ports";
import {
  createCalibrationDefinition,
  createCalibrationDefinitionSummary,
  createCalibrationRun,
  createDeviceCalibration,
  createIotDeviceDetail,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ITransportAdapter } from "@repo/iot";
import { KIPRIM_COMMANDS, KiprimDcSource, MiniParDriver, MicroPythonParReference } from "@repo/iot";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationWizard } from "./calibration-wizard";

vi.mock("@/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: vi.fn(),
}));

const mockOpenSerialPort = vi.fn<() => Promise<ITransportAdapter>>();

vi.mock("@/hooks/iot/useIotCommunication/useIotCommunication", () => ({
  openSerialPort: () => mockOpenSerialPort(),
}));

// Plotly has no business in jsdom; the review test covers the chart's inputs.
vi.mock("@/components/iot-devices/calibration/calibration-fit-chart", () => ({
  CalibrationFitChart: () => <div data-testid="fit-chart" />,
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

/**
 * A MiniPAR console: `par_raw` answers a reading, calibration writers echo
 * the value and the readback reports what they stored. Every line the wizard
 * sends is kept so the test can assert the exact console traffic a bench
 * session produces.
 */
function miniparConsole(readings: number[], calibratedPar = 398.1) {
  const sent: string[] = [];
  const queue = [...readings];
  const stored = { slope: 1, intercept: 0 };
  let deliver: ((data: string) => void) | undefined;

  function reply(line: string): string {
    const [command, value] = line.split(",");
    switch (command) {
      case "par_raw":
        return `\n${(queue.shift() ?? 0).toFixed(2)}\n`;
      case "par":
        return `\n${calibratedPar.toFixed(2)}\n`;
      case "cal_par_slope":
        stored.slope = Number(value);
        return `\n${value}\n`;
      case "cal_par_intercept":
        stored.intercept = Number(value);
        return `\n${value}\n`;
      case "get_cal_par":
        return `\nslope=${stored.slope.toFixed(6)},intercept=${stored.intercept.toFixed(6)}\n`;
      case "hello":
        return "\nMiniPAR,1.03\n";
      case "get_name":
        return "\nBench-7\n";
      default:
        return "error:unknown_command\n";
    }
  }

  const transport: ITransportAdapter = {
    isConnected: () => true,
    send: (payload) => {
      const line = payload.trim();
      sent.push(line);
      const answer = reply(line);
      setTimeout(() => deliver?.(answer), 0);
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

/** The same bench, checked once after the write: calibrated PAR beside the reference. */
const DEFINITION_WITH_CHECK = createCalibrationDefinition({
  id: DEFINITION_ID,
  family: "minipar",
  captureProcedure: {
    ...DEFINITION.captureProcedure,
    verify: [
      {
        kind: "read",
        series: "par_check",
        prompt: "Keep both sensors in the same light for the check reading.",
        read: [
          { instrument: "dut", command: "par", as: "par" },
          { operator: "Enter the reference meter reading", as: "par_ref", type: "number" },
        ],
      },
    ],
  },
});

const SWEEP_CURRENTS = [0.8, 2.4, 0];

/** The same bench with the lamp and the reference on their own ports: no reading is typed in. */
const AUTOMATED_DEFINITION = createCalibrationDefinition({
  id: DEFINITION_ID,
  family: "minipar",
  captureProcedure: {
    instruments: [
      { role: "dut" },
      { role: "lamp", handshake: new KiprimDcSource().identityToken },
      { role: "par_ref", handshake: new MicroPythonParReference().identityToken },
    ],
    steps: [
      {
        kind: "sweep",
        series: "par_sweep",
        stimulus: { instrument: "lamp", set: "current_a", values: SWEEP_CURRENTS },
        read: [
          { instrument: "dut", command: "par_raw", as: "par_raw" },
          { instrument: "par_ref", command: "par", as: "par_ref" },
        ],
      },
    ],
  },
});

type Connections = ReturnType<typeof useIotConnections>;

function mountConnections(overrides: Partial<Connections> = {}): Connections {
  const connections: Connections = {
    connections: [],
    isConnecting: false,
    error: null,
    connect: vi.fn(() => Promise.resolve()),
    disconnectDevice: vi.fn(() => Promise.resolve()),
    disconnectAll: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  vi.mocked(useIotConnections).mockReturnValue(connections);
  return connections;
}

function attachMiniPar(readings: number[]) {
  const console = miniparConsole(readings);
  const driver = new MiniParDriver({ timeoutMs: 500, protocolTimeoutMs: 500 });
  driver.initialize(console.transport);
  mountConnections({
    connections: [
      {
        id: "conn-1",
        label: "MiniPAR",
        family: "minipar",
        identity: { family: "minipar", raw: {} },
        driver,
      },
    ],
  });
  return console;
}

function renderWizard(onClose = vi.fn()) {
  render(
    <CalibrationWizard
      device={createIotDeviceDetail({ id: DEVICE_ID, deviceType: "minipar" })}
      family="minipar"
      onClose={onClose}
    />,
  );
  return onClose;
}

/** Choose the procedure, pass the connect step, and answer all three points. */
async function captureThreePoints() {
  await userEvent.click(await screen.findByRole("radio"));
  await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));
  await screen.findByText("iot.calibration.connect.connected");
  await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

  for (const reference of ["402.12", "142.92", "6.92"]) {
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.prompt.continue" }),
    );
    await userEvent.type(await screen.findByRole("textbox"), reference);
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));
  }
}

describe("CalibrationWizard", () => {
  beforeEach(() => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ id: DEFINITION_ID, family: "minipar" })],
    });
    server.mount(contract.iot.getCalibrationDefinition, { body: DEFINITION });
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
  });

  it("runs the manual MiniPAR procedure from choosing it to a confirmed, checked write", async () => {
    server.mount(contract.iot.getCalibrationDefinition, { body: DEFINITION_WITH_CHECK });
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

    // The procedure's check: acknowledge the instruction, read the device, type the reference.
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.prompt.continue" }),
    );
    await userEvent.type(await screen.findByRole("textbox"), "398.5");
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.prompt.submit" }));
    expect(await screen.findByText("398.5")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "iot.calibration.done.close" })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));

    await waitFor(() => {
      expect(screen.getByText("iot.calibration.done.writtenHint")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));
    expect(onClose).toHaveBeenCalled();

    // The submission carried the three captured rows and the device's version.
    expect(createSpy.params.deviceId).toBe(DEVICE_ID);
    // The write goes on record before the check, with what the device said about
    // itself afterwards; the check's readings follow in a second report.
    expect(reportSpy.callCount).toBe(2);
    expect(reportSpy.calls[0].body).toMatchObject({
      writeResults: { par: { verified: true } },
      postInfo: { helloReply: "MiniPAR,1.03", deviceName: "Bench-7" },
    });
    expect(reportSpy.calls[0].body).not.toHaveProperty("verification");
    expect(reportSpy.body).toMatchObject({
      writeResults: { par: { verified: true } },
      verification: { par_check: [{ par: 398.1, par_ref: 398.5 }] },
      postInfo: { helloReply: "MiniPAR,1.03", deviceName: "Bench-7" },
    });

    // The console saw three raw reads, both coefficient writers and their
    // readback, the identity read for the record, then the check's calibrated
    // read, in order.
    expect(console.sent).toEqual([
      "par_raw",
      "par_raw",
      "par_raw",
      "cal_par_slope,0.96",
      "cal_par_intercept,-1.08",
      "get_cal_par",
      "hello",
      "get_name",
      "par",
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

  it("offers to connect when no device is attached, and can go back to choosing", async () => {
    Object.defineProperty(navigator, "serial", { value: {}, configurable: true });
    const connections = mountConnections();
    renderWizard();

    await userEvent.click(await screen.findByRole("radio"));
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

    expect(await screen.findByText("iot.calibration.connect.hint")).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.connect.action" }),
    );
    expect(connections.connect).toHaveBeenCalledWith("serial");
    expect(screen.getByRole("button", { name: "iot.calibration.cta.next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.back" }));
    expect(await screen.findByText("iot.calibration.choose.hint")).toBeInTheDocument();
    Reflect.deleteProperty(navigator, "serial");
  });

  it("explains why the port cannot be opened in this browser", async () => {
    mountConnections({ error: "Port is already in use" });
    renderWizard();

    await userEvent.click(await screen.findByRole("radio"));
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

    expect(
      await screen.findByText("iot.calibration.connect.unsupportedBrowser"),
    ).toBeInTheDocument();
    expect(screen.getByText("Port is already in use")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iot.calibration.connect.action" })).toBeDisabled();
  });

  it("rejects a run without writing anything to the device", async () => {
    const console = attachMiniPar([420, 150, 8.33]);
    server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });
    server.mount(contract.iot.rejectCalibrationRun, {
      body: createCalibrationRun({ status: "rejected" }),
    });
    const onClose = renderWizard();

    await captureThreePoints();
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.review.reject" }),
    );

    expect(await screen.findByText("iot.calibration.done.rejectedHint")).toBeInTheDocument();
    expect(console.sent).toEqual(["par_raw", "par_raw", "par_raw"]);
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("stays on the review and says so when approval fails", async () => {
    attachMiniPar([420, 150, 8.33]);
    server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });
    server.mount(contract.iot.approveCalibrationRun, { status: 500 });
    renderWizard();

    await captureThreePoints();
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.review.approve" }),
    );

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        title: "iot.calibration.review.approveFailed",
        variant: "destructive",
      });
    });
    expect(screen.getByRole("button", { name: "iot.calibration.review.approve" })).toBeEnabled();
  });

  // The coefficients are on the device by the time the report fails; the
  // operator must see both facts, not a blank step.
  it("keeps the write results in view when reporting them fails", async () => {
    attachMiniPar([420, 150, 8.33]);
    server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });
    server.mount(contract.iot.approveCalibrationRun, {
      status: 201,
      body: createDeviceCalibration({ deviceId: DEVICE_ID }),
    });
    server.mount(contract.iot.reportDeviceCalibrationWrite, { status: 500 });
    renderWizard();

    await captureThreePoints();
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.review.approve" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.write.action" }),
    );

    expect(await screen.findByText("iot.calibration.write.verified")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  // The coefficients are already on the device when the operator walks away
  // from the check; the write is recorded as it stands, without a verification.
  it("records the write without a check when the operator declines it", async () => {
    server.mount(contract.iot.getCalibrationDefinition, { body: DEFINITION_WITH_CHECK });
    const console = attachMiniPar([420, 150, 8.33]);
    server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });
    const applied = createDeviceCalibration({ deviceId: DEVICE_ID });
    server.mount(contract.iot.approveCalibrationRun, { status: 201, body: applied });
    const reportSpy = server.mount(contract.iot.reportDeviceCalibrationWrite, {
      body: { ...applied, writtenToDeviceAt: "2026-09-01T10:06:00.000Z" },
    });
    renderWizard();

    await captureThreePoints();
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.review.approve" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.write.action" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "iot.calibration.prompt.decline" }),
    );

    expect(
      await screen.findByText("iot.calibration.write.verificationStopped"),
    ).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.write.verified")).toBeInTheDocument();
    await waitFor(() => {
      expect(reportSpy.called).toBe(true);
    });
    expect(reportSpy.callCount).toBe(1);
    expect(reportSpy.body).not.toHaveProperty("verification");
    expect(console.sent).not.toContain("par");
  });

  it("shows a load failure instead of an empty list of procedures", async () => {
    mountConnections();
    server.mount(contract.iot.listCalibrationDefinitions, { status: 500 });
    renderWizard();

    expect(await screen.findByText("iot.calibration.loadError")).toBeInTheDocument();
  });

  it("says when no procedure exists for the family", async () => {
    mountConnections();
    server.mount(contract.iot.listCalibrationDefinitions, { body: [] });
    renderWizard();

    expect(await screen.findByText("iot.calibration.choose.empty")).toBeInTheDocument();
  });

  describe("a procedure that declares bench instruments", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "serial", { value: {}, configurable: true });
      mockOpenSerialPort.mockReset();
      server.mount(contract.iot.getCalibrationDefinition, { body: AUTOMATED_DEFINITION });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "serial");
    });

    async function chooseProcedure() {
      await userEvent.click(await screen.findByRole("radio"));
      await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));
      await screen.findByText("iot.calibration.connect.roleHeading");
    }

    function benchRow(index: number) {
      const bench = screen.getByRole("list", { name: "iot.calibration.connect.roleHeading" });
      return within(bench).getAllByRole("listitem")[index];
    }

    async function connectBenchRole(index: number) {
      await userEvent.click(
        within(benchRow(index)).getByRole("button", {
          name: "iot.calibration.connect.roleAction",
        }),
      );
    }

    it("runs a bench with a supply and a reference", async () => {
      const device = attachMiniPar([420, 150, 8.33]);
      const supply = supplyPort();
      const reference = referencePort([402.12, 142.92, 6.92]);
      mockOpenSerialPort
        .mockResolvedValueOnce(supply.transport)
        .mockResolvedValueOnce(reference.transport);
      const createSpy = server.mount(contract.iot.createCalibrationRun, {
        status: 201,
        body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
      });
      renderWizard();

      await chooseProcedure();
      await connectBenchRole(0);
      await connectBenchRole(1);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "iot.calibration.cta.next" })).toBeEnabled();
      });
      await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

      await screen.findByRole("button", { name: "iot.calibration.review.approve" });

      // Every reading came off an instrument, so no operator prompt stood between the points.
      expect(createSpy.body).toMatchObject({
        payload: {
          par_sweep: [
            { stimulus: 0.8, par_raw: 420, par_ref: 402.12 },
            { stimulus: 2.4, par_raw: 150, par_ref: 142.92 },
            { stimulus: 0, par_raw: 8.33, par_ref: 6.92 },
          ],
        },
      });
      expect(device.sent).toEqual(["par_raw", "par_raw", "par_raw"]);
      await waitFor(() => {
        expect(supply.sent).toEqual([
          KIPRIM_COMMANDS.IDENTIFY,
          KIPRIM_COMMANDS.setCurrent(0.8),
          KIPRIM_COMMANDS.setCurrent(2.4),
          KIPRIM_COMMANDS.setCurrent(0),
          KIPRIM_COMMANDS.setCurrent(0),
        ]);
      });
    });

    // Walking away is the path an operator takes most often, and the one that would
    // leave a lamp driving current with no page left to turn it off.
    it("rests the bench and closes its ports when the operator leaves", async () => {
      attachMiniPar([420]);
      const supply = supplyPort();
      mockOpenSerialPort.mockResolvedValueOnce(supply.transport);
      const onClose = renderWizard();

      await chooseProcedure();
      await connectBenchRole(0);
      await waitFor(() => {
        expect(
          within(benchRow(0)).getByText("iot.calibration.connect.roleConnected"),
        ).toBeInTheDocument();
      });

      // Back to the picker, then out: the ports were opened and must not stay open.
      await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.back" }));
      await userEvent.click(
        await screen.findByRole("button", { name: "iot.calibration.cta.cancel" }),
      );

      expect(onClose).toHaveBeenCalled();
      await waitFor(() => {
        expect(supply.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
      });
      expect(supply.transport.isConnected()).toBe(false);
    });

    it("returns the rig to rest when the run aborts", async () => {
      attachMiniPar([420, 150, 8.33]);
      const supply = supplyPort();
      // One reading short: the second point cannot be read and the sweep stops there.
      const reference = referencePort([402.12]);
      mockOpenSerialPort
        .mockResolvedValueOnce(supply.transport)
        .mockResolvedValueOnce(reference.transport);
      const createSpy = server.mount(contract.iot.createCalibrationRun, {
        status: 201,
        body: createCalibrationRun(),
      });
      renderWizard();

      await chooseProcedure();
      await connectBenchRole(0);
      await connectBenchRole(1);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "iot.calibration.cta.next" })).toBeEnabled();
      });
      await userEvent.click(screen.getByRole("button", { name: "iot.calibration.cta.next" }));

      expect(await screen.findByText("iot.calibration.capture.aborted")).toBeInTheDocument();
      expect(createSpy.called).toBe(false);
      expect(supply.sent).toContain(KIPRIM_COMMANDS.setCurrent(2.4));
      await waitFor(() => {
        expect(supply.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
      });
    });

    it("holds the run back when a bench port answers as another instrument, and says what answered", async () => {
      attachMiniPar([420]);
      mockOpenSerialPort.mockResolvedValue(referencePort([402.12]).transport);
      renderWizard();

      await chooseProcedure();
      await connectBenchRole(0);

      expect(await screen.findByText("iot.calibration.connect.roleMismatch")).toBeInTheDocument();
      expect(within(benchRow(0)).getByText(/raw REPL/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "iot.calibration.cta.next" })).toBeDisabled();
    });
  });
});
