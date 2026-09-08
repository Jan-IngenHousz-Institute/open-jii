import { Injectable } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { CalibrationRunWithVersionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

// Run routes carry the run id, not the device id, so device authorization happens here.
@Injectable()
export class GetCalibrationRunUseCase {
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
      action: "read",
    });
    if (!decision.allow) {
      return failure(AppError.forbidden("You do not have access to this device"));
    }

    return success(run.value);
  }
}
