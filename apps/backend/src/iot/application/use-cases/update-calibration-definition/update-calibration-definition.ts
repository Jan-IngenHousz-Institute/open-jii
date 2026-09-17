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

    const existing = await this.definitionRepository.findById(definitionId);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    if (!existing.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }

    const runs = await this.definitionRepository.countRuns(definitionId);
    if (runs.isFailure()) {
      return failure(runs.error);
    }
    if (runs.value > 0) {
      return failure(
        AppError.badRequest(
          "This definition has been run and cannot be edited; copy it into a new one instead",
        ),
      );
    }

    if (body.name !== undefined && body.name !== existing.value.name) {
      const clash = await this.definitionRepository.findLatestByName(body.name);
      if (clash.isFailure()) {
        return failure(clash.error);
      }
      if (clash.value) {
        return failure(AppError.badRequest(`A calibration named "${body.name}" already exists`));
      }
    }

    const updated = await this.definitionRepository.update(definitionId, body);
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    if (!updated.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }
    return success(updated.value);
  }
}
