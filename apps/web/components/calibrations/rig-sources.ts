/**
 * What the rig a procedure declares can be asked for, and driven through.
 *
 * The step fields offer these rather than taking free text, because every one of them is
 * a name that only fails at the bench: a reading an instrument does not have, a setpoint
 * it cannot drive, a command the firmware never answers.
 */
import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { benchInstrumentSummaries, familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";

import { isAuxiliaryInstrument } from "./procedure-edits";

export interface ReadSource {
  role: string;
  /** Commands or reading names this role answers. */
  offered: string[];
  /** Whether `offered` is the whole set, as it is for bench equipment. */
  isExhaustive: boolean;
}

export interface SetpointOption {
  name: string;
  unit: string;
  min: number;
  max: number;
  integer: boolean;
}

export interface SetpointTarget {
  role: string;
  setpoints: SetpointOption[];
}

export function readSources(procedure: CaptureProcedure, family: CalibrationFamily): ReadSource[] {
  const commands = isSensorFamily(family) ? familyCalibrationCapabilities(family).commands : [];

  return procedure.instruments.map((instrument) => {
    if (!isAuxiliaryInstrument(instrument)) {
      // A device answers whatever its firmware knows; the driver's table is the
      // documented part of that, not the whole of it.
      return { role: instrument.role, offered: commands, isExhaustive: false };
    }

    const model = benchInstrumentSummaries().find(
      (candidate) => candidate.model === instrument.model,
    );

    return {
      role: instrument.role,
      offered: (model?.readings ?? []).map((reading) => reading.name),
      isExhaustive: model !== undefined,
    };
  });
}

/** Roles with something to drive; one with nothing to set is not a target at all. */
export function setpointTargets(
  procedure: CaptureProcedure,
  family: CalibrationFamily,
): SetpointTarget[] {
  const deviceSetpoints = isSensorFamily(family)
    ? familyCalibrationCapabilities(family).deviceSetpoints
    : [];

  return procedure.instruments
    .map((instrument) => {
      if (!isAuxiliaryInstrument(instrument)) {
        return { role: instrument.role, setpoints: deviceSetpoints };
      }

      const model = benchInstrumentSummaries().find(
        (candidate) => candidate.model === instrument.model,
      );

      return {
        role: instrument.role,
        setpoints: (model?.setpoints ?? []).map((setpoint) => ({
          name: setpoint.name,
          unit: setpoint.unit,
          min: setpoint.min,
          max: setpoint.max,
          integer: false,
        })),
      };
    })
    .filter((target) => target.setpoints.length > 0);
}
