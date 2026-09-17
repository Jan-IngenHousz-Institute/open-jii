import { Injectable } from "@nestjs/common";

import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { Result } from "../../../../common/utils/fp-utils";
import type { CalibrationDefinitionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class ListCalibrationDefinitionsUseCase {
  constructor(private readonly definitionRepository: IotCalibrationDefinitionRepository) {}

  execute(userId: string, family?: CalibrationFamily): Promise<Result<CalibrationDefinitionDto[]>> {
    return this.definitionRepository.listAccessible(userId, { family });
  }
}
