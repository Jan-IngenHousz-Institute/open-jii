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

    // A name is one definition's version line; it cannot change family or
    // organization mid-line, or runs pinned to older versions become ambiguous.
    const latest = await this.definitionRepository.findLatestByName(body.name);
    if (latest.isFailure()) {
      return failure(latest.error);
    }
    if (latest.value && latest.value.family !== body.family) {
      return failure(
        AppError.badRequest(
          `Definition "${body.name}" already exists for family "${latest.value.family}"`,
        ),
      );
    }
    // A new version joins an existing line, so it lands in the organization that
    // already owns it. `@CanCreateInOrg` only vets an organizationId the body
    // carries, so without this an outsider could plant a version inside another
    // organization's line and hold creator control over it.
    if (latest.value) {
      if (
        body.organizationId !== undefined &&
        body.organizationId !== latest.value.organizationId
      ) {
        return failure(
          AppError.badRequest(`Definition "${body.name}" belongs to a different organization`),
        );
      }

      const owningOrg = latest.value.organizationId;
      const permitted = owningOrg
        ? await this.authz.isOrgMember(userId, owningOrg)
        : latest.value.createdBy === userId;
      if (!permitted) {
        return failure(
          AppError.forbidden(`You cannot add a version to the definition "${body.name}"`),
        );
      }
    }

    const result = await this.definitionRepository.create(
      {
        family: body.family,
        name: body.name,
        description: body.description ?? null,
        captureProcedure: body.captureProcedure,
        script: body.script,
        outputSchema: body.outputSchema,
      },
      userId,
      latest.value ? latest.value.organizationId : (body.organizationId ?? null),
    );
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success(result.value[0]);
  }
}
