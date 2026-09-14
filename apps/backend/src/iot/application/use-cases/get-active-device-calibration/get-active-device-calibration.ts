import { Injectable } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { DeviceCalibrationDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

@Injectable()
export class GetActiveDeviceCalibrationUseCase {
  constructor(private readonly runRepository: IotCalibrationRunRepository) {}

  execute(deviceId: string): Promise<Result<DeviceCalibrationDto | null>> {
    return this.runRepository.findActiveByDevice(deviceId);
  }
}
