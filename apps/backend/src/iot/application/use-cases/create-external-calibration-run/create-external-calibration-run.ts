import { Injectable, Logger } from "@nestjs/common";

import type { CreateExternalCalibrationRunBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { hasComputedBlock, validateCalibrationBlocks } from "../../../core/calibration-blocks";
import type { CalibrationRunWithVersionDto } from "../../../core/models/iot-calibration.model";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

/**
 * A bench tool submits blocks it computed itself. The platform re-validates
 * them against the definition's schema and gates on intake, so an external run
 * reaches review with the same guarantees as a platform-computed one; the
 * sandbox is never invoked.
 *
 * The definition's `minFirmwareVersion` is deliberately not enforced here. It
 * guards capture, which happened outside the platform, and this is the path
 * historical bench runs are imported through: those legitimately predate a
 * minimum set later.
 */
@Injectable()
export class CreateExternalCalibrationRunUseCase {
  private readonly logger = new Logger(CreateExternalCalibrationRunUseCase.name);

  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(
    body: CreateExternalCalibrationRunBody,
    userId: string,
  ): Promise<Result<CalibrationRunWithVersionDto>> {
    this.logger.log({
      msg: "Recording external calibration run",
      operation: "createExternalCalibrationRun",
      deviceId: body.deviceId,
      definitionId: body.definitionId,
      userId,
    });

    const definition = await this.definitionRepository.findById(body.definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }
    if (!definition.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }

    const device = await this.deviceRepository.findById(body.deviceId);
    if (device.isFailure()) {
      return failure(device.error);
    }
    if (!device.value) {
      return failure(AppError.notFound("Device not found"));
    }
    if (device.value.deviceType !== definition.value.family) {
      return failure(
        AppError.badRequest(
          `Definition targets family "${definition.value.family}" but the device is a "${device.value.deviceType}"`,
        ),
      );
    }

    const violations = validateCalibrationBlocks(body.blocks, definition.value.outputSchema);
    if (violations.length > 0) {
      return failure(
        AppError.badRequest(`Submitted blocks failed validation: ${violations.join("; ")}`),
      );
    }
    if (!hasComputedBlock(body.blocks)) {
      return failure(AppError.badRequest("No submitted block produced coefficients"));
    }

    const run = await this.runRepository.create({
      definitionId: body.definitionId,
      deviceId: body.deviceId,
      requestedBy: userId,
      inputSource: "external_bench",
      status: "computed",
      blocks: body.blocks,
      payload: body.payload,
      params: body.params,
      preInfo: body.preInfo,
      postInfo: body.postInfo,
      firmwareVersion: body.firmwareVersion,
      finishedAt: new Date(),
    });
    if (run.isFailure()) {
      return failure(run.error);
    }

    return success(run.value);
  }
}
