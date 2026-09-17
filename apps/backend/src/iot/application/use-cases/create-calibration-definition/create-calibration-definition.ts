import { Injectable, Logger } from "@nestjs/common";

import type { CreateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationDefinitionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class CreateCalibrationDefinitionUseCase {
  private readonly logger = new Logger(CreateCalibrationDefinitionUseCase.name);

  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    body: CreateCalibrationDefinitionBody,
    userId: string,
  ): Promise<Result<CalibrationDefinitionDto>> {
    this.logger.log({
      msg: "Creating calibration definition",
      operation: "createCalibrationDefinition",
      name: body.name,
      family: body.family,
      userId,
    });

    // One definition per name. Versioning is deferred until the program's first cut has
    // landed, so a name that is taken is a conflict rather than the next version of it.
    const existing = await this.definitionRepository.findLatestByName(body.name);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (existing.value) {
      return failure(AppError.badRequest(`A calibration named "${body.name}" already exists`));
    }

    const result = await this.definitionRepository.create(
      {
        family: body.family,
        name: body.name,
        description: body.description ?? null,
        captureProcedure: body.captureProcedure,
        script: body.script,
        outputSchema: body.outputSchema,
        // Dropping this silently would leave the firmware gate on every definition the
        // API creates permanently open, and older firmware answers unknown commands with
        // numbers that look like readings.
        minFirmwareVersion: body.minFirmwareVersion ?? null,
      },
      userId,
      body.organizationId ?? null,
    );
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success(result.value[0]);
  }
}
