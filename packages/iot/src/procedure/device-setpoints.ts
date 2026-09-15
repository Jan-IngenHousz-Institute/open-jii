/**
 * Setpoints a procedure applies to the device under test itself, declared per family.
 * Bench equipment carries its own on BenchInstrument; a family driver has nowhere to put
 * them, so the registry is here and the binding is the sibling of bindBenchInstrument.
 */
import type { SensorFamily } from "../core/families";
import { AMBIT_COMMANDS } from "../driver/ambit/commands";
import type { IDeviceDriver } from "../driver/driver-base";
import { MULTISPEQ_COMMANDS } from "../driver/multispeq/commands";
import type { SetpointTarget } from "./interpreter";

export interface DeviceSetpoint {
  readonly name: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** A DAC level or an LED step has no fractions. */
  readonly integer?: boolean;
  /** The level that is safe to walk away from, written back when the rig is rested. */
  readonly rest: number;
  /** False where the console answers nothing, so the driver must not wait for a reply. */
  readonly expectReply?: boolean;
  command(value: number): string;
}

/** Not confirmed against the firmware: the factory bench sweeps to 250. */
const AMBIT_LED_MAX_STEP = 255;

// The level latches until the next write, so a sweep ends by writing 0 to turn the LED off.
const AMBIT_LED_SETTING: DeviceSetpoint = {
  name: "led_setting",
  unit: "step",
  min: 0,
  max: AMBIT_LED_MAX_STEP,
  integer: true,
  rest: 0,
  command: (value) => `${AMBIT_COMMANDS.ARRUN1},1,1,2,0,0,1,0,1,${value},1,\n,`,
};

/** The LEDs the bench drives; the board may carry more. */
const MULTISPEQ_LED_COUNT = 6;

/** The board's 12-bit DAC width, unconfirmed. */
const MULTISPEQ_LED_MAX_DAC = 4095;

const MULTISPEQ_LED_SETPOINTS: readonly DeviceSetpoint[] = Array.from(
  { length: MULTISPEQ_LED_COUNT },
  (_unused, offset): DeviceSetpoint => {
    const index = offset + 1;

    return {
      name: `led_${index}`,
      unit: "dac",
      min: 0,
      max: MULTISPEQ_LED_MAX_DAC,
      integer: true,
      rest: 0,
      // The bench writes this one silently and reads nothing back.
      expectReply: false,
      command: (value) => `${MULTISPEQ_COMMANDS.LED_DAC}+${index}+${value}+`,
    };
  },
);

export const DEVICE_SETPOINTS: Partial<Record<SensorFamily, readonly DeviceSetpoint[]>> = {
  ambit: [AMBIT_LED_SETTING],
  multispeq: MULTISPEQ_LED_SETPOINTS,
};

export interface DeviceSetpointTarget extends SetpointTarget {
  /**
   * Write every setpoint this session drove back to its safe level. A device left
   * latched at the last sweep point is the hazard a bench must never be left in.
   * Propagates the console's failure, as a bench instrument's shutdown does.
   */
  rest(): Promise<void>;
}

/** Undefined where the family declares nothing to set: such a device can only be read. */
export function bindDeviceSetpoints(driver: IDeviceDriver): DeviceSetpointTarget | undefined {
  const family = driver.family;
  if (!family) {
    return undefined;
  }

  const setpoints = DEVICE_SETPOINTS[family];
  if (!setpoints?.length) {
    return undefined;
  }

  const driven = new Set<DeviceSetpoint>();

  const write = async (setpoint: DeviceSetpoint, value: number) => {
    const level = setpoint.integer ? Math.round(value) : value;
    const result = await driver.execute(
      setpoint.command(level),
      setpoint.expectReply === false ? { expectReply: false } : undefined,
    );

    if (!result.success) {
      throw result.error ?? new Error(`Setting ${setpoint.name} on the ${family} device failed`);
    }
  };

  return {
    applySetpoint: async (name: string, value: number) => {
      const setpoint = setpoints.find((candidate) => candidate.name === name);
      if (!setpoint) {
        throw new Error(`The ${family} family has no setpoint "${name}"`);
      }

      if (!Number.isFinite(value) || value < setpoint.min || value > setpoint.max) {
        throw new Error(
          `Setpoint ${name} must be between ${setpoint.min} and ${setpoint.max} ${setpoint.unit}`,
        );
      }

      await write(setpoint, value);
      driven.add(setpoint);
    },

    rest: async () => {
      for (const setpoint of driven) {
        await write(setpoint, setpoint.rest);
      }
      driven.clear();
    },
  };
}
