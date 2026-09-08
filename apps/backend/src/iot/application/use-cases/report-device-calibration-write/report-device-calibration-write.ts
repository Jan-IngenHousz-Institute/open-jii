import { Injectable, Logger } from "@nestjs/common";

import type { ReportDeviceCalibrationWriteBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { DeviceCalibrationDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";

/**
 * The wizard reports the NVS write it performed over its open connection,
 * addressed to the specific applied row so a concurrent approval cannot get
 * another run's write recorded on it.
 */
@Injectable()
export class ReportDeviceCalibrationWriteUseCase {
  private readonly logger = new Logger(ReportDeviceCalibrationWriteUseCase.name);

  constructor(
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    body: ReportDeviceCalibrationWriteBody,
    userId: string,
  ): Promise<Result<DeviceCalibrationDto>> {
    const { calibrationId, writeResults, postInfo } = body;
    const calibration = await this.runRepository.findCalibrationById(calibrationId);
    if (calibration.isFailure()) {
      return failure(calibration.error);
    }
    if (!calibration.value) {
      return failure(AppError.notFound("Device calibration not found"));
    }
    const applied = calibration.value;

    const decision = await this.authz.can(userId, {
      resourceType: "device",
      resourceId: applied.deviceId,
      action: "manage",
    });
    if (!decision.allow) {
      return failure(AppError.forbidden("Reporting a write requires device manage rights"));
    }

    this.logger.log({
      msg: "Recording device calibration write",
      operation: "reportDeviceCalibrationWrite",
      calibrationId,
      deviceId: applied.deviceId,
      blocks: Object.keys(writeResults),
      userId,
    });

    // A write can only be reported against a block this calibration applied;
    // anything else means the client wrote something nobody approved.
    const unknown = Object.keys(writeResults).filter((name) => !(name in applied.blocks));
    if (unknown.length > 0) {
      return failure(
        AppError.badRequest(
          `Write results name blocks this calibration did not apply: ${unknown.join(", ")}`,
        ),
      );
    }

    const updated = await this.runRepository.markWritten(calibrationId, writeResults, postInfo);
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    return success(updated.value);
  }
}
