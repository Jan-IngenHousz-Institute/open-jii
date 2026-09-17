import { Injectable, Logger, Inject } from "@nestjs/common";

import { payloadSeriesIssue } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  firmwareFloorIssue,
  hasComputedBlock,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CreateCalibrationRunBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type {
  CalibrationDefinitionDto,
  CalibrationRunWithVersionDto,
} from "../../../core/models/iot-calibration.model";
import { zCalibrationSandboxResponse } from "../../../core/models/iot-calibration.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class CreateCalibrationRunUseCase {
  private readonly logger = new Logger(CreateCalibrationRunUseCase.name);

  constructor(
    private readonly definitionRepository: IotCalibrationDefinitionRepository,
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly authz: AuthorizationService,
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async execute(
    body: CreateCalibrationRunBody,
    userId: string,
  ): Promise<Result<CalibrationRunWithVersionDto>> {
    this.logger.log({
      msg: "Creating calibration run",
      operation: "createCalibrationRun",
      deviceId: body.deviceId,
      definitionId: body.definitionId,
      userId,
    });

    const definition = await this.resolveDefinition(body.deviceId, body.definitionId, userId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }

    const firmwareIssue = firmwareFloorIssue(
      definition.value.minFirmwareVersion,
      body.firmwareVersion,
    );
    if (firmwareIssue) {
      return failure(AppError.badRequest(firmwareIssue));
    }

    const seriesIssue = payloadSeriesIssue(definition.value.captureProcedure, body.payload);
    if (seriesIssue) {
      return failure(AppError.badRequest(seriesIssue));
    }

    const run = await this.runRepository.create({
      definitionId: body.definitionId,
      deviceId: body.deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
      payload: body.payload,
      params: body.params,
      preInfo: body.preInfo,
      firmwareVersion: body.firmwareVersion,
    });
    if (run.isFailure()) {
      return failure(run.error);
    }

    return this.invokeAndSave(run.value.id, definition.value, body);
  }

  private async resolveDefinition(
    deviceId: string,
    definitionId: string,
    userId: string,
  ): Promise<Result<CalibrationDefinitionDto>> {
    const definition = await this.definitionRepository.findById(definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }
    if (!definition.value) {
      return failure(AppError.notFound("Calibration definition not found"));
    }

    // The route guard authorizes the device; the definition is named in the
    // body, so running one the caller cannot read is refused here.
    const readable = await this.authz.can(userId, {
      resourceType: "calibration_definition",
      resourceId: definitionId,
      action: "read",
    });
    if (!readable.allow) {
      return failure(AppError.forbidden("Running a calibration requires read access to it"));
    }

    const device = await this.deviceRepository.findById(deviceId);
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

    return success(definition.value);
  }

  private async invokeAndSave(
    runId: string,
    definition: CalibrationDefinitionDto,
    body: CreateCalibrationRunBody,
  ): Promise<Result<CalibrationRunWithVersionDto>> {
    const invoke = await this.awsPort.invokeLambda(
      this.awsPort.getCalibrationSandboxFunctionName(),
      {
        script: definition.script,
        series: body.payload,
        params: body.params ?? {},
        outputSchema: definition.outputSchema,
      },
    );

    if (invoke.isFailure()) {
      this.logger.error({
        msg: "Calibration sandbox invoke failed",
        operation: "createCalibrationRun",
        runId,
        error: invoke.error.message,
      });
      return this.runRepository.saveResult(runId, {
        status: "error",
        errorMessage: invoke.error.message,
      });
    }

    const parsed = zCalibrationSandboxResponse.safeParse(invoke.value.payload);
    if (!parsed.success) {
      this.logger.error({
        msg: "Calibration sandbox returned an unrecognized payload",
        operation: "createCalibrationRun",
        runId,
      });
      return this.runRepository.saveResult(runId, {
        status: "error",
        errorMessage: "Calibration sandbox returned an unrecognized payload",
      });
    }

    const response = parsed.data;
    if (response.status === "computed") {
      // Every block rejected or skipped leaves nothing to apply: a failure, with the blocks kept for review.
      if (!hasComputedBlock(response.blocks)) {
        return this.runRepository.saveResult(runId, {
          status: "compute_failed",
          blocks: response.blocks,
          errorMessage: "No block produced coefficients",
        });
      }
      return this.runRepository.saveResult(runId, {
        status: "computed",
        blocks: response.blocks,
      });
    }

    const detail =
      response.status === "compute_failed" && response.reasons
        ? `${response.error}: ${response.reasons.join("; ")}`
        : response.error;
    return this.runRepository.saveResult(runId, {
      status: response.status,
      errorMessage: detail,
    });
  }
}
