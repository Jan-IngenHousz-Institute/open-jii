import { Injectable } from "@nestjs/common";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import type {
  ActiveCalibrationBlockDto,
  ActiveDeviceCalibrationDto,
  DeviceCalibrationDto,
} from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

/**
 * What the device is running on, assembled from the newest approval per block.
 *
 * A bench session need not produce every block: one procedure may calibrate the PAR line
 * while another calibrates the spectral channels, and a block whose fit was rejected is
 * simply absent. Reading the newest approval alone would therefore report that the device
 * had lost coefficients it is demonstrably still holding.
 */

@Injectable()
export class GetActiveDeviceCalibrationUseCase {
  constructor(private readonly runRepository: IotCalibrationRunRepository) {}

  async execute(deviceId: string): Promise<Result<ActiveDeviceCalibrationDto | null>> {
    const history = await this.runRepository.listCalibrationsByDevice(deviceId);
    if (history.isFailure()) {
      return failure(history.error);
    }
    if (history.value.length === 0) {
      return success(null);
    }

    return success({ deviceId, blocks: this.newestBlockPerName(history.value) });
  }

  /** Approvals arrive newest first, so the first sighting of a block is the one in force. */
  private newestBlockPerName(
    history: DeviceCalibrationDto[],
  ): Record<string, ActiveCalibrationBlockDto> {
    const inForce: Record<string, ActiveCalibrationBlockDto> = {};

    for (const calibration of history) {
      for (const [name, block] of Object.entries(calibration.blocks)) {
        if (name in inForce) {
          continue;
        }
        inForce[name] = {
          coefficients: block.coefficients,
          fit: block.fit,
          quality: block.quality,
          calibrationId: calibration.id,
          runId: calibration.runId,
          validFrom: calibration.validFrom,
          // Approving and writing are separate events, and the write is recorded per
          // block, so each block carries whether it actually reached the device.
          writtenToDeviceAt: calibration.writtenToDeviceAt,
          writeResult: calibration.writeResults?.[name] ?? null,
        };
      }
    }

    return inForce;
  }
}
