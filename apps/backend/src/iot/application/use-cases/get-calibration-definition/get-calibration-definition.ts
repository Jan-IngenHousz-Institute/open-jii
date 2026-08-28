import { Injectable } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationDefinitionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class GetCalibrationDefinitionUseCase {
  constructor(private readonly definitionRepository: IotCalibrationDefinitionRepository) {}

  async execute(definitionId: string): Promise<Result<CalibrationDefinitionDto>> {
    const result = await this.definitionRepository.findById(definitionId);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (!result.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }
    return success(result.value);
  }
}
