import { Injectable, Logger } from "@nestjs/common";

import type { UpdateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationDefinitionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

/**
 * Edits a definition in place. A run records the definition it ran, not a copy of it, so
 * editing one that has already been run changes what those runs appear to have done.
 * Versioning is what would fix that and it is deferred, so a definition with runs is
 * closed to edits rather than quietly rewriting their history.
 */
@Injectable()
export class UpdateCalibrationDefinitionUseCase {
  private readonly logger = new Logger(UpdateCalibrationDefinitionUseCase.name);

  constructor(private readonly definitionRepository: IotCalibrationDefinitionRepository) {}

  async execute(
    definitionId: string,
    body: UpdateCalibrationDefinitionBody,
    userId: string,
  ): Promise<Result<CalibrationDefinitionDto>> {
    this.logger.log({
      msg: "Updating calibration definition",
      operation: "updateCalibrationDefinition",
      definitionId,
      userId,
    });

    // The repository refuses the edit in the same statement that checks for runs, so a
    // run recorded while this request is in flight still freezes the definition.
    const updated = await this.definitionRepository.update(definitionId, body);
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    if (updated.value) {
      return success(updated.value);
    }

    const existing = await this.definitionRepository.findById(definitionId);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (!existing.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }
    return failure(
      AppError.badRequest(
        "This definition has been run and cannot be edited; copy it into a new one instead",
      ),
    );
  }
}
