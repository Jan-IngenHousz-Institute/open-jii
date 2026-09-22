import { Injectable } from "@nestjs/common";

import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { resolveResourceCapabilities } from "../../../../authorization/resource-capabilities";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationDefinitionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

/** Row plus what the caller may do with it; the controller formats its dates. */
type CalibrationDefinitionWithCapabilities = CalibrationDefinitionDto & {
  capabilities: ResourceCapabilities;
  runCount: number;
};

@Injectable()
export class GetCalibrationDefinitionUseCase {
  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    definitionId: string,
    userId: string,
  ): Promise<Result<CalibrationDefinitionWithCapabilities>> {
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

    // The same guard the update use case applies, sent ahead of the attempt: otherwise the
    // page offers every field and the edits are refused once, at the save.
    const runs = await this.definitionRepository.countRuns(definitionId);
    if (runs.isFailure()) {
      return failure(runs.error);
    }

    return success({ ...result.value, capabilities, runCount: runs.value });
  }
}
