import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class DeleteCalibrationDefinitionUseCase {
  private readonly logger = new Logger(DeleteCalibrationDefinitionUseCase.name);

  constructor(private readonly definitionRepository: IotCalibrationDefinitionRepository) {}

  async execute(definitionId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting calibration definition",
      operation: "deleteCalibrationDefinition",
      definitionId,
      userId,
    });

    const result = await this.definitionRepository.delete(definitionId);
    if (result.isFailure()) {
      // The runs FK is RESTRICT on purpose: runs are the audit trail of what
      // produced a coefficient, so a used definition version cannot vanish.
      // `tryCatch` already classified the constraint violation.
      if (result.error.code === "REPOSITORY_REFERENCE") {
        return failure(
          AppError.badRequest("This definition version has runs and cannot be deleted"),
        );
      }
      return failure(result.error);
    }
    if (result.value.length === 0) {
      return failure(AppError.notFound("Calibration definition not found"));
    }
    return success(undefined);
  }
}
