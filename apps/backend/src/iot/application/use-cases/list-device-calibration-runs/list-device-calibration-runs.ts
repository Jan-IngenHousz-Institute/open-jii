import { Injectable } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { CalibrationRunWithVersionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

@Injectable()
export class ListDeviceCalibrationRunsUseCase {
  constructor(private readonly runRepository: IotCalibrationRunRepository) {}

  execute(deviceId: string): Promise<Result<CalibrationRunWithVersionDto[]>> {
    return this.runRepository.listByDevice(deviceId);
  }
}
