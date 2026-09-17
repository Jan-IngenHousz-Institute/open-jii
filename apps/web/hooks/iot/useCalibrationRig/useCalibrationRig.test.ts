import { referencePort, supplyPort, unknownPort } from "@/test/bench-ports";
import { renderHook, act, assertExists } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CaptureProcedure, IDeviceDriver, ITransportAdapter } from "@repo/iot";
import { KIPRIM_COMMANDS, KiprimDcSource, MicroPythonParReference } from "@repo/iot";

import type { RigRole, RigRoleStatus } from "./useCalibrationRig";
import { useCalibrationRig } from "./useCalibrationRig";

const mockOpenSerialPort = vi.fn<() => Promise<ITransportAdapter>>();

vi.mock("../useIotCommunication/useIotCommunication", () => ({
  openSerialPort: () => mockOpenSerialPort(),
}));

const SUPPLY_HANDSHAKE = new KiprimDcSource().identityToken;
const SUPPLY_MODEL = new KiprimDcSource().model;
const REFERENCE_HANDSHAKE = new MicroPythonParReference().identityToken;

/** Declaration order deliberately differs from the order the steps reach for each role. */
const PROCEDURE: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "par_ref", handshake: REFERENCE_HANDSHAKE },
    { role: "lamp", handshake: SUPPLY_HANDSHAKE },
    { role: "stray_ref", handshake: REFERENCE_HANDSHAKE },
  ],
  steps: [
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4, 0] },
      read: [
        { instrument: "dut", command: "get_par", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "read",
      series: "stray_light",
      optional: true,
      read: [{ instrument: "stray_ref", command: "par", as: "stray" }],
    },
  ],
};

function statusOf(rig: { roles: RigRole[] }, role: string): RigRoleStatus | undefined {
  return rig.roles.find((entry) => entry.role === role)?.status;
}

function replyOf(status: RigRoleStatus | undefined): string {
  if (status?.kind !== "connected" && status?.kind !== "mismatch") {
    throw new Error(`A ${status?.kind ?? "missing"} role carries no identity reply`);
  }
  return status.reply;
}

describe("useCalibrationRig", () => {
  beforeEach(() => {
    mockOpenSerialPort.mockReset();
  });

  it("lists one row per declared bench instrument, in declaration order, marking which a run needs", () => {
    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));

    expect(result.current.roles.map((entry) => entry.role)).toEqual([
      "par_ref",
      "lamp",
      "stray_ref",
    ]);
    expect(result.current.roles.map((entry) => entry.required)).toEqual([true, true, false]);
    expect(result.current.roles.every((entry) => entry.status.kind === "idle")).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it("lists nothing while no procedure is loaded", () => {
    const { result } = renderHook(() => useCalibrationRig(undefined, undefined));

    expect(result.current.roles).toEqual([]);
    expect(result.current.bindings).toEqual({});
  });

  it("binds a supply to its role and exposes a setpoint binding for it", async () => {
    const port = supplyPort();
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));

    const lamp = statusOf(result.current, "lamp");
    expect(lamp).toMatchObject({ kind: "connected", model: SUPPLY_MODEL });
    expect(replyOf(lamp)).toContain(SUPPLY_HANDSHAKE);
    expect(result.current.bindings.lamp?.read).toBeUndefined();
    expect(result.current.hasEveryRequiredRole).toBe(false);

    const setpoint = result.current.bindings.lamp?.setpoint;
    assertExists(setpoint);
    await act(() => setpoint.applySetpoint("current_a", 1.5));

    expect(port.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(1.5));
  });

  it("reads a reference sensor through the role that declared it", async () => {
    const port = referencePort([118.5, 0.4]);
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("par_ref"));

    const read = result.current.bindings.par_ref?.read;
    assertExists(read);

    await expect(read.execute("par")).resolves.toEqual({ success: true, data: 118.5 });
    await expect(read.execute("par")).resolves.toEqual({ success: true, data: 0.4 });
  });

  it("refuses a port whose instrument is not the one the role declared, closes it, and reports what answered", async () => {
    const port = supplyPort();
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("par_ref"));

    const parRef = statusOf(result.current, "par_ref");
    expect(parRef).toMatchObject({ kind: "mismatch" });
    expect(replyOf(parRef)).toContain(SUPPLY_HANDSHAKE);
    expect(result.current.bindings.par_ref).toBeUndefined();
    expect(port.transport.isConnected()).toBe(false);
    expect(port.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
  });

  it("reports a port nothing identified, and closes it", async () => {
    const port = unknownPort("DATALOGGER, 8 channel, 2.1");
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));

    expect(statusOf(result.current, "lamp")).toEqual({ kind: "unrecognised" });
    expect(result.current.bindings.lamp).toBeUndefined();
    expect(port.transport.isConnected()).toBe(false);
  });

  it("reports a port that could not be opened", async () => {
    mockOpenSerialPort.mockRejectedValue(new Error("No port was selected"));

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));

    expect(statusOf(result.current, "lamp")).toEqual({
      kind: "failed",
      message: "No port was selected",
    });
    expect(result.current.isConnecting).toBe(false);
  });

  it("returns a connected supply to rest without closing its port", async () => {
    const port = supplyPort();
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));

    const setpoint = result.current.bindings.lamp?.setpoint;
    assertExists(setpoint);
    await act(() => setpoint.applySetpoint("current_a", 2.4));

    await act(() => result.current.rest());

    expect(port.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
    expect(port.transport.isConnected()).toBe(true);
    expect(statusOf(result.current, "lamp")?.kind).toBe("connected");
  });

  it("closes every port on shutdownAll and forgets the roles", async () => {
    const lamp = supplyPort();
    const reference = referencePort([80]);
    mockOpenSerialPort
      .mockResolvedValueOnce(lamp.transport)
      .mockResolvedValueOnce(reference.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));
    await act(() => result.current.connectRole("par_ref"));

    await act(() => result.current.shutdownAll());

    expect(lamp.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
    expect(lamp.transport.isConnected()).toBe(false);
    expect(reference.transport.isConnected()).toBe(false);
    expect(result.current.roles.every((entry) => entry.status.kind === "idle")).toBe(true);
    expect(result.current.bindings).toEqual({});
  });

  it("disconnects one role and leaves the rest of the rig connected", async () => {
    const lamp = supplyPort();
    const reference = referencePort([80]);
    mockOpenSerialPort
      .mockResolvedValueOnce(lamp.transport)
      .mockResolvedValueOnce(reference.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));
    await act(() => result.current.connectRole("par_ref"));

    await act(() => result.current.disconnectRole("lamp"));

    expect(statusOf(result.current, "lamp")).toEqual({ kind: "idle" });
    expect(lamp.sent.at(-1)).toBe(KIPRIM_COMMANDS.setCurrent(0));
    expect(lamp.transport.isConnected()).toBe(false);
    expect(statusOf(result.current, "par_ref")?.kind).toBe("connected");
    expect(reference.transport.isConnected()).toBe(true);

    // A role nothing is plugged into is a no-op.
    await act(() => result.current.disconnectRole("stray_ref"));

    expect(statusOf(result.current, "par_ref")?.kind).toBe("connected");
  });

  // A port reporting itself gone is a read-loop failure, not proof the writer is dead, so
  // forgetting the role would leave the supply driving its last current with nothing left
  // that could reach it.
  it("releases a role whose port reports itself disconnected", async () => {
    const port = supplyPort();
    mockOpenSerialPort.mockResolvedValue(port.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));
    port.sent.length = 0;

    await act(async () => {
      port.emitStatus(false);
      await Promise.resolve();
    });

    expect(statusOf(result.current, "lamp")).toEqual({ kind: "idle" });
    expect(result.current.bindings.lamp).toBeUndefined();
    expect(port.sent).toEqual([KIPRIM_COMMANDS.setCurrent(0)]);
    expect(port.disconnects).toBe(1);
  });

  it("discards a connect that lands after shutdownAll, closing its port", async () => {
    const port = supplyPort();
    let openPort: (transport: ITransportAdapter) => void = () => undefined;
    mockOpenSerialPort.mockReturnValue(
      new Promise<ITransportAdapter>((resolve) => {
        openPort = resolve;
      }),
    );

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));

    let connecting = Promise.resolve();
    act(() => {
      connecting = result.current.connectRole("lamp");
    });

    expect(statusOf(result.current, "lamp")).toEqual({ kind: "connecting" });
    expect(result.current.isConnecting).toBe(true);

    await act(() => result.current.shutdownAll());
    await act(async () => {
      openPort(port.transport);
      await connecting;
    });

    expect(statusOf(result.current, "lamp")).toEqual({ kind: "idle" });
    expect(result.current.bindings.lamp).toBeUndefined();
    expect(port.transport.isConnected()).toBe(false);
  });

  it("hasEveryRequiredRole ignores a role only an optional step reads", async () => {
    const lamp = supplyPort();
    const reference = referencePort([80]);
    mockOpenSerialPort
      .mockResolvedValueOnce(lamp.transport)
      .mockResolvedValueOnce(reference.transport);

    const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));
    await act(() => result.current.connectRole("lamp"));
    await act(() => result.current.connectRole("par_ref"));

    expect(statusOf(result.current, "stray_ref")).toEqual({ kind: "idle" });
    expect(result.current.hasEveryRequiredRole).toBe(true);
  });

  // The device under test is one role of the rig, and it latches what a sweep wrote to
  // it exactly as the lamp does, so the rig is what returns it to rest.
  describe("the device under test", () => {
    function fakeAmbit() {
      const sent: string[] = [];
      const driver: IDeviceDriver = {
        family: "ambit",
        initialize: () => undefined,
        execute: (command: string | object) => {
          sent.push(typeof command === "string" ? command : JSON.stringify(command));
          return Promise.resolve({ success: true });
        },
        destroy: () => Promise.resolve(),
      };

      return { driver, sent };
    }

    it("binds the device as a role the procedure can read and drive", () => {
      const { driver } = fakeAmbit();

      const { result } = renderHook(() => useCalibrationRig(PROCEDURE, driver));

      const dut = result.current.bindings.dut;
      expect(dut?.read).toBe(driver);
      expect(dut?.setpoint).toBeDefined();
    });

    it("offers no setpoint for a family that drives none", () => {
      const { driver } = fakeAmbit();
      const minipar: IDeviceDriver = { ...driver, family: "minipar" };

      const { result } = renderHook(() => useCalibrationRig(PROCEDURE, minipar));

      expect(result.current.bindings.dut?.read).toBe(minipar);
      expect(result.current.bindings.dut?.setpoint).toBeUndefined();
    });

    it("binds nothing while no device is connected", () => {
      const { result } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));

      expect(result.current.bindings.dut).toBeUndefined();
    });

    it("returns a setpoint the run drove back to its safe level when the rig rests", async () => {
      const { driver, sent } = fakeAmbit();
      const { result } = renderHook(() => useCalibrationRig(PROCEDURE, driver));

      await act(async () => {
        await result.current.bindings.dut?.setpoint?.applySetpoint("led_setting", 250);
      });
      sent.length = 0;

      await act(async () => {
        await result.current.rest();
      });

      expect(sent).toEqual(["arrun1,1,1,2,0,0,1,0,1,0,1,\n,"]);
    });

    // The device's port belongs to the connection hook, which closes it on the same unmount.
    // Queued behind the bench's writes, its rest would lose the port mid-command.
    it("rests the device before the bench, whose ports it owns itself", async () => {
      const order: string[] = [];
      const lamp = supplyPort();
      const write = lamp.transport.send;
      lamp.transport.send = (data: string) => {
        order.push("lamp");
        return write(data);
      };
      mockOpenSerialPort.mockResolvedValueOnce(lamp.transport);

      const { driver } = fakeAmbit();
      driver.execute = () => {
        order.push("dut");
        return Promise.resolve({ success: true });
      };

      const { result } = renderHook(() => useCalibrationRig(PROCEDURE, driver));
      await act(() => result.current.connectRole("lamp"));
      await act(async () => {
        await result.current.bindings.dut?.setpoint?.applySetpoint("led_setting", 250);
      });
      order.length = 0;

      await act(async () => {
        await result.current.rest();
      });

      expect(order).toEqual(["dut", "lamp"]);
    });

    it("returns it to rest when the wizard unmounts", async () => {
      const { driver, sent } = fakeAmbit();
      const { result, unmount } = renderHook(() => useCalibrationRig(PROCEDURE, driver));

      await act(async () => {
        await result.current.bindings.dut?.setpoint?.applySetpoint("led_setting", 250);
      });
      sent.length = 0;

      unmount();
      await act(async () => {
        await Promise.resolve();
      });

      expect(sent).toEqual(["arrun1,1,1,2,0,0,1,0,1,0,1,\n,"]);
    });
  });

  describe("leaving the bench", () => {
    it("closes every port when the wizard unmounts", async () => {
      const supply = supplyPort();
      mockOpenSerialPort.mockResolvedValueOnce(supply.transport);
      const { result, unmount } = renderHook(() => useCalibrationRig(PROCEDURE, undefined));

      await act(async () => {
        await result.current.connectRole("lamp");
      });
      supply.sent.length = 0;

      unmount();
      await act(async () => {
        await Promise.resolve();
      });

      expect(supply.sent).toEqual([KIPRIM_COMMANDS.setCurrent(0)]);
      expect(supply.transport.isConnected()).toBe(false);
    });

    // A role of the same name in the next definition may want another instrument, so a
    // port bound under the old one must not satisfy it unchecked.
    // A handshake can name a unit rather than a model, so the reply alone does not say
    // whether the right equipment is on the port.
    it("refuses a port that answers the handshake but is not the instrument the role expects", async () => {
      const port = supplyPort();
      mockOpenSerialPort.mockResolvedValue(port.transport);
      const wrongModel: CaptureProcedure = {
        instruments: [
          { role: "dut" },
          { role: "lamp", handshake: SUPPLY_HANDSHAKE, model: "minipar-reference" },
        ],
        steps: [{ kind: "set", instrument: "lamp", set: "current_a", value: 0 }],
      };

      const { result } = renderHook(() => useCalibrationRig(wrongModel, undefined));
      await act(() => result.current.connectRole("lamp"));

      const status = statusOf(result.current, "lamp");
      expect(status).toMatchObject({ kind: "mismatch", model: SUPPLY_MODEL });
      expect(result.current.bindings.lamp).toBeUndefined();
      expect(port.transport.isConnected()).toBe(false);
    });

    it("binds a port whose instrument is the one the role names", async () => {
      const port = supplyPort();
      mockOpenSerialPort.mockResolvedValue(port.transport);
      const declared: CaptureProcedure = {
        instruments: [
          { role: "lamp", handshake: SUPPLY_HANDSHAKE, model: SUPPLY_MODEL },
          { role: "dut" },
        ],
        steps: [{ kind: "set", instrument: "lamp", set: "current_a", value: 0 }],
      };

      const { result } = renderHook(() => useCalibrationRig(declared, undefined));
      await act(() => result.current.connectRole("lamp"));

      expect(statusOf(result.current, "lamp")?.kind).toBe("connected");
      expect(result.current.bindings.lamp).toBeDefined();
    });

    it("lets the bench go when the procedure declares a different rig", async () => {
      const supply = supplyPort();
      mockOpenSerialPort.mockResolvedValueOnce(supply.transport);
      const { result, rerender } = renderHook(
        ({ procedure }: { procedure: CaptureProcedure | undefined }) =>
          useCalibrationRig(procedure, undefined),
        { initialProps: { procedure: PROCEDURE } },
      );

      await act(async () => {
        await result.current.connectRole("lamp");
      });
      expect(statusOf(result.current, "lamp")?.kind).toBe("connected");

      const otherBench: CaptureProcedure = {
        ...PROCEDURE,
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "OTHER-SUPPLY" }],
      };
      rerender({ procedure: otherBench });
      await act(async () => {
        await Promise.resolve();
      });

      expect(statusOf(result.current, "lamp")?.kind).toBe("idle");
      expect(result.current.hasEveryRequiredRole).toBe(false);
      expect(supply.transport.isConnected()).toBe(false);
    });
  });
});
