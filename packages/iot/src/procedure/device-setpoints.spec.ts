import { describe, expect, it, vi } from "vitest";

import type { SensorFamily } from "../core/families";
import type { IDeviceDriver } from "../driver/driver-base";
import { DEVICE_SETPOINTS, bindDeviceSetpoints } from "./device-setpoints";
import type { DeviceSetpointTarget } from "./device-setpoints";

interface FakeConsole {
  success: boolean;
  error?: Error;
}

/** A console that records what was written to it, standing in for a family driver. */
function fakeDevice(
  family: SensorFamily | undefined,
  reply: FakeConsole | ((command: string) => FakeConsole) = { success: true },
) {
  const answer = typeof reply === "function" ? reply : () => reply;
  const execute = vi.fn((command: string | object, _options?: { expectReply?: boolean }) =>
    Promise.resolve(answer(typeof command === "string" ? command : JSON.stringify(command))),
  );

  const driver: IDeviceDriver = {
    family,
    initialize: () => undefined,
    execute,
    destroy: () => Promise.resolve(),
  };

  return { driver, execute };
}

function bindOrFail(driver: IDeviceDriver): DeviceSetpointTarget {
  const target = bindDeviceSetpoints(driver);
  if (!target) {
    throw new Error(`Expected ${String(driver.family)} to declare setpoints`);
  }
  return target;
}

describe("bindDeviceSetpoints", () => {
  it("binds nothing for a family that declares no setpoints", () => {
    expect(bindDeviceSetpoints(fakeDevice("minipar").driver)).toBeUndefined();
  });

  it("binds nothing for a driver that reports no family", () => {
    expect(bindDeviceSetpoints(fakeDevice(undefined).driver)).toBeUndefined();
  });

  it("applies an Ambit LED level as the exact two-line console command", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 150);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,150,1,\n,", undefined);
  });

  it("turns the Ambit LED off with a level of zero", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 0);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,0,1,\n,", undefined);
  });

  it("rounds a fractional level before building the command", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await bindOrFail(driver).applySetpoint("led_setting", 12.6);

    expect(execute).toHaveBeenCalledWith("arrun1,1,1,2,0,0,1,0,1,13,1,\n,", undefined);
  });

  it("refuses a level above the maximum without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", 256)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a level below the minimum without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", -1)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a level that is not a finite number without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_setting", Number.NaN)).rejects.toThrow(
      "Setpoint led_setting must be between 0 and 255 step",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses an unknown setpoint name without touching the device", async () => {
    const { driver, execute } = fakeDevice("ambit");

    await expect(bindOrFail(driver).applySetpoint("led_current", 10)).rejects.toThrow(
      'The ambit family has no setpoint "led_current"',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("surfaces a console failure as a thrown error carrying the driver's message", async () => {
    const { driver } = fakeDevice("ambit", { success: false, error: new Error("BAD COMMAND") });

    await expect(bindOrFail(driver).applySetpoint("led_setting", 10)).rejects.toThrow(
      "BAD COMMAND",
    );
  });

  it("names the setpoint when a failing console reports no error", async () => {
    const { driver } = fakeDevice("ambit", { success: false });

    await expect(bindOrFail(driver).applySetpoint("led_setting", 10)).rejects.toThrow(
      "Setting led_setting on the ambit device failed",
    );
  });

  // The board answers this write with nothing, so waiting for a reply would time
  // out on healthy hardware and put the driver's cancel switch behind the command.
  it("applies a MultispeQ LED brightness as a DAC command the driver must not wait on", async () => {
    const { driver, execute } = fakeDevice("multispeq");

    await bindOrFail(driver).applySetpoint("led_3", 800);

    expect(execute).toHaveBeenCalledWith("ledDac+3+800+", { expectReply: false });
  });

  it("refuses a MultispeQ brightness past the DAC width", async () => {
    const { driver, execute } = fakeDevice("multispeq");

    await expect(bindOrFail(driver).applySetpoint("led_3", 4096)).rejects.toThrow(
      "Setpoint led_3 must be between 0 and 4095 dac",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("declares one MultispeQ setpoint per LED the bench drives", () => {
    const names = DEVICE_SETPOINTS.multispeq?.map((setpoint) => setpoint.name);

    expect(names).toEqual(["led_1", "led_2", "led_3", "led_4", "led_5", "led_6"]);
  });

  // A device latched at the last sweep point is the hazard the rig exists to avoid:
  // the LED holds its level until something writes another one.
  describe("resting the device", () => {
    it("writes every setpoint it drove back to its safe level", async () => {
      const { driver, execute } = fakeDevice("multispeq");
      const target = bindOrFail(driver);

      await target.applySetpoint("led_2", 500);
      await target.applySetpoint("led_5", 800);
      execute.mockClear();

      await target.rest();

      expect(execute.mock.calls.map(([command]) => command)).toEqual([
        "ledDac+2+0+",
        "ledDac+5+0+",
      ]);
    });

    it("writes nothing for a device it never drove", async () => {
      const { driver, execute } = fakeDevice("ambit");

      await bindOrFail(driver).rest();

      expect(execute).not.toHaveBeenCalled();
    });

    it("rests a setpoint once, however many times the sweep drove it", async () => {
      const { driver, execute } = fakeDevice("ambit");
      const target = bindOrFail(driver);

      await target.applySetpoint("led_setting", 10);
      await target.applySetpoint("led_setting", 250);
      execute.mockClear();

      await target.rest();

      expect(execute.mock.calls.map(([command]) => command)).toEqual([
        "arrun1,1,1,2,0,0,1,0,1,0,1,\n,",
      ]);
    });

    // A console that refuses one LED at rest time must not leave the ones after it lit.
    it("rests the setpoints after one the console refuses", async () => {
      const refuseSecondRest = (command: string) =>
        command === "ledDac+2+0+"
          ? { success: false, error: new Error("port hiccup") }
          : { success: true };
      const { driver, execute } = fakeDevice("multispeq", refuseSecondRest);
      const target = bindOrFail(driver);

      await target.applySetpoint("led_1", 500);
      await target.applySetpoint("led_2", 400);
      await target.applySetpoint("led_3", 800);
      execute.mockClear();

      await expect(target.rest()).rejects.toThrow("port hiccup");

      expect(execute.mock.calls.map(([command]) => command)).toEqual([
        "ledDac+1+0+",
        "ledDac+2+0+",
        "ledDac+3+0+",
      ]);
    });

    it("keeps only what it could not rest queued for the next attempt", async () => {
      let refuse = true;
      const console_ = (command: string) =>
        refuse && command === "ledDac+1+0+"
          ? { success: false, error: new Error("port closed") }
          : { success: true };
      const { driver, execute } = fakeDevice("multispeq", console_);
      const target = bindOrFail(driver);

      await target.applySetpoint("led_1", 500);
      await target.applySetpoint("led_3", 800);
      await expect(target.rest()).rejects.toThrow("port closed");
      refuse = false;
      execute.mockClear();

      await target.rest();

      expect(execute.mock.calls.map(([command]) => command)).toEqual(["ledDac+1+0+"]);
    });

    // The Ambit latches the level and only then answers; a console that fails that
    // answer has still lit the LED, so the rig must know to turn it off.
    it("rests a level the console latched before refusing to acknowledge it", async () => {
      let refuse = true;
      const console_ = (command: string) =>
        refuse && command.includes(",250,")
          ? { success: false, error: new Error("Ambit did not acknowledge arrun1") }
          : { success: true };
      const { driver, execute } = fakeDevice("ambit", console_);
      const target = bindOrFail(driver);

      await expect(target.applySetpoint("led_setting", 250)).rejects.toThrow("did not acknowledge");
      refuse = false;
      execute.mockClear();

      await target.rest();

      expect(execute.mock.calls.map(([command]) => command)).toEqual([
        "arrun1,1,1,2,0,0,1,0,1,0,1,\n,",
      ]);
    });

    it("forgets what it rested, so a second rest is silent", async () => {
      const { driver, execute } = fakeDevice("ambit");
      const target = bindOrFail(driver);

      await target.applySetpoint("led_setting", 250);
      await target.rest();
      execute.mockClear();

      await target.rest();

      expect(execute).not.toHaveBeenCalled();
    });
  });
});
