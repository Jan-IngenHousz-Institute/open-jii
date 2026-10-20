import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ResourceDeletedNotifier } from "../../../../notifications/application/services/resource-deleted-notifier";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class DeleteCalibrationDefinitionUseCase {
  private readonly logger = new Logger(DeleteCalibrationDefinitionUseCase.name);

  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly deletionNotifier: ResourceDeletedNotifier,
  ) {}

  async execute(definitionId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting calibration definition",
      operation: "deleteCalibrationDefinition",
      definitionId,
      userId,
    });

    const members = await this.sharingRepository.listMemberIds(
      "calibration_definition",
      definitionId,
    );
    const name = await this.sharingRepository.findResourceName(
      "calibration_definition",
      definitionId,
    );

    const result = await this.definitionRepository.delete(definitionId);
    if (result.isFailure()) {
      // The runs FK is RESTRICT: a used version cannot vanish. tryCatch classifies the violation.
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

    await this.deletionNotifier.notify({
      operation: "deleteCalibrationDefinition",
      actorId: userId,
      resource: { type: "calibration_definition", id: definitionId },
      name: name,
      members,
    });
    return success(undefined);
  }
}
