import { Injectable, Logger } from "@nestjs/common";

import { verificationSeriesIssue } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { serialsMatch } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { ReportDeviceCalibrationWriteBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { DeviceCalibrationDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/** Addressed to the applied row so a concurrent approval cannot get another run's write recorded on it. */
@Injectable()
export class ReportDeviceCalibrationWriteUseCase {
  private readonly logger = new Logger(ReportDeviceCalibrationWriteUseCase.name);

  constructor(
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    body: ReportDeviceCalibrationWriteBody,
    userId: string,
  ): Promise<Result<DeviceCalibrationDto>> {
    const { calibrationId, writeResults, postInfo, verification, reportedSerial } = body;
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

    // The unit that took the write said who it is; a write onto another unit is not this
    // device's calibration, however the session was addressed.
    if (reportedSerial !== undefined) {
      const mismatch = await this.serialMismatch(applied.deviceId, reportedSerial);
      if (mismatch.isFailure()) {
        return failure(mismatch.error);
      }
    }

    this.logger.log({
      msg: "Recording device calibration write",
      operation: "reportDeviceCalibrationWrite",
      calibrationId,
      deviceId: applied.deviceId,
      blocks: Object.keys(writeResults),
      verificationSeries: Object.keys(verification ?? {}),
      userId,
    });

    // Only blocks this calibration applied; anything else was written without approval.
    const unknown = Object.keys(writeResults).filter((name) => !(name in applied.blocks));
    if (unknown.length > 0) {
      return failure(
        AppError.badRequest(
          `Write results name blocks this calibration did not apply: ${unknown.join(", ")}`,
        ),
      );
    }

    if (verification) {
      const verificationIssue = await this.checkVerificationSeries(applied.runId, verification);
      if (verificationIssue.isFailure()) {
        return failure(verificationIssue.error);
      }
    }

    const updated = await this.runRepository.markWritten(
      calibrationId,
      writeResults,
      postInfo,
      verification,
    );
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    return success(updated.value);
  }

  /** Only series the procedure's verify phase produces; anything else is not this calibration's check. */
  private async checkVerificationSeries(
    runId: string,
    verification: NonNullable<ReportDeviceCalibrationWriteBody["verification"]>,
  ): Promise<Result<void>> {
    const run = await this.runRepository.findById(runId);
    if (run.isFailure()) {
      return failure(run.error);
    }
    if (!run.value) {
      return failure(AppError.notFound("Calibration run not found"));
    }
    const definition = await this.definitionRepository.findById(run.value.definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }
    if (!definition.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }

    const issue = verificationSeriesIssue(definition.value.captureProcedure, verification);
    if (issue) {
      return failure(AppError.badRequest(issue));
    }
    return success(undefined);
  }

  private async serialMismatch(deviceId: string, reportedSerial: string): Promise<Result<void>> {
    const device = await this.deviceRepository.findById(deviceId);
    if (device.isFailure()) {
      return failure(device.error);
    }
    if (!device.value) {
      return failure(AppError.notFound("Device not found"));
    }
    if (!serialsMatch(reportedSerial, device.value.serialNumber)) {
      return failure(
        AppError.badRequest(
          `The connected device reports serial "${reportedSerial}", not this device's "${device.value.serialNumber}"`,
        ),
      );
    }
    return success(undefined);
  }
}
