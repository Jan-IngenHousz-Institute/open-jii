import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import {
  appliedCalibrationBlocks,
  hasComputedBlock,
  validateCalibrationBlocks,
} from "../../../core/calibration-blocks";
import type { DeviceCalibrationDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

/**
 * Nothing a script produced takes effect until someone with device manage rights
 * approves it; approval supersedes the active calibration in one transaction.
 */
@Injectable()
export class ApproveCalibrationRunUseCase {
  private readonly logger = new Logger(ApproveCalibrationRunUseCase.name);

  constructor(
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(runId: string, userId: string): Promise<Result<DeviceCalibrationDto>> {
    const run = await this.runRepository.findById(runId);
    if (run.isFailure()) {
      return failure(run.error);
    }
    if (!run.value) {
      return failure(AppError.notFound("Calibration run not found"));
    }

    const decision = await this.authz.can(userId, {
      resourceType: "device",
      resourceId: run.value.deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return failure(AppError.forbidden("Approving a calibration requires device manage rights"));
    }

    if (run.value.status !== "computed" || !run.value.blocks) {
      return failure(AppError.badRequest("Only a computed run can be approved"));
    }

    // Re-validated at the gate: the bounds are what a coefficient is about to be trusted against.
    const definition = await this.definitionRepository.findById(run.value.definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }
    if (!definition.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }
    const violations = validateCalibrationBlocks(run.value.blocks, definition.value.outputSchema);
    if (violations.length > 0) {
      return failure(
        AppError.badRequest(`Run blocks fail the output schema: ${violations.join("; ")}`),
      );
    }

    if (!hasComputedBlock(run.value.blocks)) {
      return failure(AppError.badRequest("This run produced no coefficients to apply"));
    }

    // Only computed blocks are applied; rejected and skipped ones stay on the run.
    const applied = appliedCalibrationBlocks(run.value.blocks);

    this.logger.log({
      msg: "Approving calibration run",
      operation: "approveCalibrationRun",
      runId,
      deviceId: run.value.deviceId,
      userId,
    });

    const approved = await this.runRepository.approve(runId, run.value.deviceId, applied, userId);
    if (approved.isFailure()) {
      return failure(approved.error);
    }
    return success(approved.value);
  }
}
