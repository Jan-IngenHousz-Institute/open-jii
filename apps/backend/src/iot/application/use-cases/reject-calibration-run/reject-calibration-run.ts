import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationRunWithVersionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

@Injectable()
export class RejectCalibrationRunUseCase {
  private readonly logger = new Logger(RejectCalibrationRunUseCase.name);

  constructor(
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(runId: string, userId: string): Promise<Result<CalibrationRunWithVersionDto>> {
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
      return failure(AppError.forbidden("Rejecting a calibration requires device manage rights"));
    }

    if (run.value.status !== "computed") {
      return failure(AppError.badRequest("Only a computed run can be rejected"));
    }

    this.logger.log({
      msg: "Rejecting calibration run",
      operation: "rejectCalibrationRun",
      runId,
      deviceId: run.value.deviceId,
      userId,
    });

    const rejected = await this.runRepository.reject(runId, userId);
    if (rejected.isFailure()) {
      return failure(rejected.error);
    }
    return success(rejected.value);
  }
}
