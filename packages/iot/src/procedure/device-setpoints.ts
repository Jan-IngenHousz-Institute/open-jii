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
  /** Milliseconds to wait for the console to answer; the default is the driver's. */
  readonly timeoutMs?: number;
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
  command: (value) => `${AMBIT_COMMANDS.ARRUN1},1,1,2,0,0,1,0,1,${value},1,\n,`,
};

const MULTISPEQ_LED_COUNT = 10;

/** The board's 12-bit DAC width, unconfirmed. */
const MULTISPEQ_LED_MAX_DAC = 4095;

/** The console is not known to acknowledge the write, so a silent board cannot stall a sweep. */
const MULTISPEQ_LED_TIMEOUT_MS = 3_000;

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
      timeoutMs: MULTISPEQ_LED_TIMEOUT_MS,
      command: (value) => `${MULTISPEQ_COMMANDS.LED_DAC}+${index}+${value}+`,
    };
  },
);

export const DEVICE_SETPOINTS: Partial<Record<SensorFamily, readonly DeviceSetpoint[]>> = {
  ambit: [AMBIT_LED_SETTING],
  multispeq: MULTISPEQ_LED_SETPOINTS,
};

/** Undefined where the family declares nothing to set: such a device can only be read. */
export function bindDeviceSetpoints(driver: IDeviceDriver): SetpointTarget | undefined {
  const family = driver.family;
  if (!family) {
    return undefined;
  }

  const setpoints = DEVICE_SETPOINTS[family];
  if (!setpoints?.length) {
    return undefined;
  }

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

      const level = setpoint.integer ? Math.round(value) : value;

      const result = await driver.execute(
        setpoint.command(level),
        setpoint.timeoutMs ? { timeoutMs: setpoint.timeoutMs } : undefined,
      );

      if (!result.success) {
        throw result.error ?? new Error(`Setting ${name} on the ${family} device failed`);
      }
    },
  };
}
