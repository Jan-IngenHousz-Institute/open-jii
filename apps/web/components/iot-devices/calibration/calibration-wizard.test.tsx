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
import { toast } from "@repo/ui/hooks/use-toast";

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
            : command === "hello"
              ? "\nMiniPAR,1.03\n"
              : command === "get_name"
                ? "\nBench-7\n"
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
    // The write report carries what the device said about itself afterwards.
    expect(reportSpy.body).toMatchObject({
      writeResults: { par: { verified: true } },
      postInfo: { helloReply: "MiniPAR,1.03", deviceName: "Bench-7" },
    });

    // The console saw three raw reads, both coefficient writers, then the
    // identity read for the record, in order.
    expect(console.sent).toEqual([
      "par_raw",
      "par_raw",
      "par_raw",
      "cal_par_slope,0.96",
      "cal_par_intercept,-1.08",
      "hello",
      "get_name",
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
});
