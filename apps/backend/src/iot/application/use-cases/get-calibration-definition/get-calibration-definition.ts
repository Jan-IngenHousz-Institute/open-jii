import { Injectable } from "@nestjs/common";

import type { CalibrationDefinitionDetail } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { resolveResourceCapabilities } from "../../../../authorization/resource-capabilities";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class GetCalibrationDefinitionUseCase {
  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    definitionId: string,
    userId: string,
  ): Promise<Result<CalibrationDefinitionDetail>> {
    const result = await this.definitionRepository.findById(definitionId);
    if (result.isFailure()) {
      return failure(result.error);
    }
    if (!result.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }

    // What the caller may do with it, so the page can offer editing without guessing.
    const capabilities = await resolveResourceCapabilities(
      this.authz,
      userId,
      "calibration_definition",
      definitionId,
    );
    return success({ ...result.value, capabilities });
  }
}
