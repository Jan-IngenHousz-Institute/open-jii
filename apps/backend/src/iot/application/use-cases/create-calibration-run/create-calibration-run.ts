import { Injectable, Logger, Inject } from "@nestjs/common";

import {
  procedureSeriesNames,
  requiredProcedureSeriesNames,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CreateCalibrationRunBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { hasComputedBlock } from "../../../core/calibration-blocks";
import { compareFirmwareVersions } from "../../../core/firmware-version";
import type {
  CalibrationDefinitionDto,
  CalibrationRunWithVersionDto,
} from "../../../core/models/iot-calibration.model";
import { zCalibrationSandboxResponse } from "../../../core/models/iot-calibration.model";
import { CALIBRATION_SANDBOX_PORT } from "../../../core/ports/calibration-sandbox.port";
import type { CalibrationSandboxPort } from "../../../core/ports/calibration-sandbox.port";
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
    @Inject(CALIBRATION_SANDBOX_PORT)
    private readonly sandboxPort: CalibrationSandboxPort,
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

    const definition = await this.resolveDefinition(body.deviceId, body.definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }

    const firmwareIssue = this.checkFirmware(definition.value, body.firmwareVersion);
    if (firmwareIssue) {
      return failure(AppError.badRequest(firmwareIssue));
    }

    const seriesIssue = this.checkSeriesCompleteness(definition.value, body.payload);
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
  ): Promise<Result<CalibrationDefinitionDto>> {
    const definition = await this.definitionRepository.findById(definitionId);
    if (definition.isFailure()) {
      return failure(definition.error);
    }
    if (!definition.value) {
      return failure(AppError.notFound("Calibration definition not found"));
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

  /**
   * The payload must carry every required series and nothing the procedure
   * cannot produce. Optional steps may be absent: a bench missing a reference
   * instrument still produces a useful run.
   */
  private checkSeriesCompleteness(
    definition: CalibrationDefinitionDto,
    payload: CreateCalibrationRunBody["payload"],
  ): string | null {
    const known = new Set(procedureSeriesNames(definition.captureProcedure));
    const required = requiredProcedureSeriesNames(definition.captureProcedure);
    const provided = new Set(Object.keys(payload));

    const missing = required.filter((name) => !provided.has(name));
    if (missing.length > 0) {
      return `Payload is missing required series: ${missing.join(", ")}`;
    }
    const unexpected = [...provided].filter((name) => !known.has(name));
    if (unexpected.length > 0) {
      return `Payload carries series the procedure does not produce: ${unexpected.join(", ")}`;
    }
    return null;
  }

  /**
   * Refuse a device whose firmware predates what the procedure needs. Commands
   * an older build does not know would answer with nothing usable, and the run
   * would record numbers that look like data.
   */
  private checkFirmware(
    definition: CalibrationDefinitionDto,
    reported: string | undefined,
  ): string | null {
    const required = definition.minFirmwareVersion;
    if (!required) {
      return null;
    }
    if (!reported) {
      return `This calibration requires firmware ${required}; the device did not report a version`;
    }

    const comparison = compareFirmwareVersions(reported, required);
    if (comparison === null) {
      return `Could not compare the device firmware ${reported} against the required ${required}`;
    }
    if (comparison < 0) {
      return `This calibration requires firmware ${required}; the device reports ${reported}`;
    }
    return null;
  }

  private async invokeAndSave(
    runId: string,
    definition: CalibrationDefinitionDto,
    body: CreateCalibrationRunBody,
  ): Promise<Result<CalibrationRunWithVersionDto>> {
    const invoke = await this.sandboxPort.invokeCalibrationSandbox({
      script: definition.script,
      series: body.payload,
      params: body.params ?? {},
      outputSchema: definition.outputSchema,
    });

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
      // The sandbox validated every computed block. A session where every
      // block was rejected or skipped produced no coefficient to apply, so it
      // is recorded as a failure with the blocks kept for review.
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
