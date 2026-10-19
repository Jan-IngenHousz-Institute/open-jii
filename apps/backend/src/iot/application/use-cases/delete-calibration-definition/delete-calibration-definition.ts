import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";

@Injectable()
export class DeleteCalibrationDefinitionUseCase {
  private readonly logger = new Logger(DeleteCalibrationDefinitionUseCase.name);

  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
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

    await this.notify(userId, definitionId, name, members);
    return success(undefined);
  }

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    definitionId: string,
    name: Result<string | null>,
    members: Result<string[]>,
  ): Promise<void> {
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the calibration definition, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteCalibrationDefinition",
        definitionId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteCalibrationDefinition",
        definitionId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "calibration_definition", id: definitionId },
      params: { resourceName: name.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the calibration definition was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteCalibrationDefinition",
        definitionId,
        error: dispatched.error,
      });
    }
  }
}
