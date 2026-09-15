import type { RigRole } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalibrationRig } from "./calibration-connect-step";
import { CalibrationConnectStep } from "./calibration-connect-step";

function role(overrides: Partial<RigRole> = {}): RigRole {
  return {
    role: "lamp",
    handshake: "KIPRIM",
    required: true,
    status: { kind: "idle" },
    ...overrides,
  };
}

function stubRig(roles: RigRole[], overrides: Partial<CalibrationRig> = {}): CalibrationRig {
  return {
    roles,
    bindings: {},
    hasEveryRequiredRole: roles.every(
      (entry) => !entry.required || entry.status.kind === "connected",
    ),
    isConnecting: roles.some((entry) => entry.status.kind === "connecting"),
    connectRole: vi.fn(() => Promise.resolve()),
    disconnectRole: vi.fn(() => Promise.resolve()),
    rest: vi.fn(() => Promise.resolve()),
    shutdownAll: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function renderStep(rig: CalibrationRig) {
  render(
    <CalibrationConnectStep
      family="minipar"
      connection={undefined}
      isConnecting={false}
      error={null}
      rig={rig}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
    />,
  );
  return rig;
}

function benchRows() {
  const bench = screen.getByRole("list", { name: "iot.calibration.connect.roleHeading" });
  return within(bench).getAllByRole("listitem");
}

describe("CalibrationConnectStep", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "serial", { value: {}, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "serial");
  });

  it("lists one row per bench instrument the procedure declares, with the handshake it expects", () => {
    renderStep(stubRig([role({ role: "lamp" }), role({ role: "par_ref", handshake: "raw REPL" })]));

    const rows = benchRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("lamp")).toBeInTheDocument();
    expect(within(rows[0]).getByText("KIPRIM")).toBeInTheDocument();
    expect(within(rows[1]).getByText("par_ref")).toBeInTheDocument();
    expect(within(rows[1]).getByText("raw REPL")).toBeInTheDocument();
  });

  it("says nothing about a bench for a procedure that declares no instruments", () => {
    renderStep(stubRig([]));

    expect(screen.queryByText("iot.calibration.connect.roleHeading")).toBeNull();
  });

  it("connects only the role whose own button was pressed", async () => {
    const rig = renderStep(stubRig([role({ role: "lamp" }), role({ role: "par_ref" })]));

    await userEvent.click(
      within(benchRows()[1]).getByRole("button", { name: "iot.calibration.connect.roleAction" }),
    );

    expect(rig.connectRole).toHaveBeenCalledWith("par_ref");
    expect(rig.connectRole).toHaveBeenCalledTimes(1);
  });

  it("names the instrument a connected row answered with, and offers to disconnect it", async () => {
    const rig = renderStep(
      stubRig([
        role({ status: { kind: "connected", model: "kiprim-dc", reply: "KIPRIM,DC310S" } }),
      ]),
    );

    const row = benchRows()[0];
    expect(within(row).getByText("iot.calibration.connect.roleConnected")).toBeInTheDocument();
    expect(within(row).getByText("kiprim-dc")).toBeInTheDocument();

    await userEvent.click(
      within(row).getByRole("button", { name: "iot.calibration.connect.disconnect" }),
    );

    expect(rig.disconnectRole).toHaveBeenCalledWith("lamp");
  });

  it("says what a mismatched port answered instead", () => {
    renderStep(
      stubRig([role({ status: { kind: "mismatch", reply: "raw REPL; CTRL-B to exit" } })]),
    );

    expect(screen.getByText("iot.calibration.connect.roleMismatch")).toBeInTheDocument();
    expect(screen.getByText("raw REPL; CTRL-B to exit")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "iot.calibration.connect.roleAction" }),
    ).toBeInTheDocument();
  });

  it("says when nothing on the port identified itself", () => {
    renderStep(stubRig([role({ status: { kind: "unrecognised" } })]));

    expect(screen.getByText("iot.calibration.connect.roleUnrecognised")).toBeInTheDocument();
  });

  it("says why a port could not be opened", () => {
    renderStep(stubRig([role({ status: { kind: "failed", message: "No port was selected" } })]));

    expect(screen.getByText("iot.calibration.connect.roleFailed")).toBeInTheDocument();
    expect(screen.getByText("No port was selected")).toBeInTheDocument();
  });

  it("marks a row the run needs apart from one whose steps it can skip", () => {
    renderStep(stubRig([role({ role: "lamp" }), role({ role: "stray_ref", required: false })]));

    const rows = benchRows();
    expect(within(rows[0]).getByText("iot.calibration.connect.roleRequired")).toBeInTheDocument();
    expect(within(rows[1]).getByText("iot.calibration.connect.roleOptional")).toBeInTheDocument();
  });

  it("names the required roles that still have to answer before the run can go on", () => {
    renderStep(
      stubRig([
        role({ role: "lamp" }),
        role({ role: "par_ref" }),
        role({ role: "stray_ref", required: false }),
      ]),
    );

    expect(screen.getByText("iot.calibration.connect.roleMissing")).toBeInTheDocument();
    expect(screen.getByText("lamp, par_ref")).toBeInTheDocument();
  });

  it("stops naming missing roles once every required one is connected", () => {
    renderStep(
      stubRig([
        role({
          role: "lamp",
          status: { kind: "connected", model: "kiprim-dc", reply: "KIPRIM,DC310S" },
        }),
        role({ role: "stray_ref", required: false }),
      ]),
    );

    expect(screen.queryByText("iot.calibration.connect.roleMissing")).toBeNull();
  });

  it("disables every port button while one port is being opened", () => {
    renderStep(
      stubRig([
        role({ role: "lamp", status: { kind: "connecting" } }),
        role({
          role: "par_ref",
          status: { kind: "connected", model: "micropython-par-reference", reply: "raw REPL" },
        }),
      ]),
    );

    expect(
      screen.getByRole("button", { name: "iot.calibration.connect.roleConnecting" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "iot.calibration.connect.disconnect" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "iot.calibration.connect.action" })).toBeDisabled();
  });

  it("disables every port button in a browser that has no serial", () => {
    Reflect.deleteProperty(navigator, "serial");
    renderStep(stubRig([role()]));

    expect(
      screen.getByRole("button", { name: "iot.calibration.connect.roleAction" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "iot.calibration.connect.action" })).toBeDisabled();
  });
});
