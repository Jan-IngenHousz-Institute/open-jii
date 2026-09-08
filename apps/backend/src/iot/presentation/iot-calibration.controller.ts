import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { iotCalibrationContract } from "@repo/api/domains/iot/calibration/iot-calibration.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ApproveCalibrationRunUseCase } from "../application/use-cases/approve-calibration-run/approve-calibration-run";
import { CreateCalibrationDefinitionUseCase } from "../application/use-cases/create-calibration-definition/create-calibration-definition";
import { CreateCalibrationRunUseCase } from "../application/use-cases/create-calibration-run/create-calibration-run";
import { CreateExternalCalibrationRunUseCase } from "../application/use-cases/create-external-calibration-run/create-external-calibration-run";
import { DeleteCalibrationDefinitionUseCase } from "../application/use-cases/delete-calibration-definition/delete-calibration-definition";
import { GetActiveDeviceCalibrationUseCase } from "../application/use-cases/get-active-device-calibration/get-active-device-calibration";
import { GetCalibrationDefinitionUseCase } from "../application/use-cases/get-calibration-definition/get-calibration-definition";
import { GetCalibrationRunUseCase } from "../application/use-cases/get-calibration-run/get-calibration-run";
import { ListCalibrationDefinitionsUseCase } from "../application/use-cases/list-calibration-definitions/list-calibration-definitions";
import { ListDeviceCalibrationRunsUseCase } from "../application/use-cases/list-device-calibration-runs/list-device-calibration-runs";
import { ListDeviceCalibrationsUseCase } from "../application/use-cases/list-device-calibrations/list-device-calibrations";
import { RejectCalibrationRunUseCase } from "../application/use-cases/reject-calibration-run/reject-calibration-run";
import { ReportDeviceCalibrationWriteUseCase } from "../application/use-cases/report-device-calibration-write/report-device-calibration-write";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

// Calibrations ride the same feature flag as the device registry they serve.
@Controller()
export class IotCalibrationController {
  private readonly logger = new Logger(IotCalibrationController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createCalibrationDefinitionUseCase: CreateCalibrationDefinitionUseCase,
    private readonly listCalibrationDefinitionsUseCase: ListCalibrationDefinitionsUseCase,
    private readonly getCalibrationDefinitionUseCase: GetCalibrationDefinitionUseCase,
    private readonly deleteCalibrationDefinitionUseCase: DeleteCalibrationDefinitionUseCase,
    private readonly createCalibrationRunUseCase: CreateCalibrationRunUseCase,
    private readonly createExternalCalibrationRunUseCase: CreateExternalCalibrationRunUseCase,
    private readonly listDeviceCalibrationRunsUseCase: ListDeviceCalibrationRunsUseCase,
    private readonly getCalibrationRunUseCase: GetCalibrationRunUseCase,
    private readonly approveCalibrationRunUseCase: ApproveCalibrationRunUseCase,
    private readonly rejectCalibrationRunUseCase: RejectCalibrationRunUseCase,
    private readonly getActiveDeviceCalibrationUseCase: GetActiveDeviceCalibrationUseCase,
    private readonly listDeviceCalibrationsUseCase: ListDeviceCalibrationsUseCase,
    private readonly reportDeviceCalibrationWriteUseCase: ReportDeviceCalibrationWriteUseCase,
  ) {}

  private devicesEnabled(session: UserSession): Promise<boolean> {
    return this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.IOT_DEVICES,
      session.user.email || session.user.id,
    );
  }

  private disabled(operation: string): never {
    return throwOrpcError(
      AppError.forbidden("The device registry is currently disabled"),
      this.logger,
      operation,
    );
  }

  @Implement(iotCalibrationContract.listCalibrationDefinitions)
  listCalibrationDefinitions(@Session() session: UserSession) {
    return implement(iotCalibrationContract.listCalibrationDefinitions).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("listCalibrationDefinitions");

        const result = await this.listCalibrationDefinitionsUseCase.execute(
          session.user.id,
          input.family,
        );

        if (result.isSuccess()) {
          return formatDatesList(
            result.value.map(
              ({
                captureProcedure: _p,
                script: _s,
                outputSchema: _o,
                minFirmwareVersion: _f,
                ...summary
              }) => summary,
            ),
          );
        }

        return throwOrpcFailure(result, this.logger, "listCalibrationDefinitions");
      },
    );
  }

  @CanAccess({ resource: "calibration_definition", action: "read", param: "definitionId" })
  @Implement(iotCalibrationContract.getCalibrationDefinition)
  getCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.getCalibrationDefinition).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getCalibrationDefinition");

      const result = await this.getCalibrationDefinitionUseCase.execute(input.definitionId);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getCalibrationDefinition");
    });
  }

  @CanCreateInOrg()
  @Implement(iotCalibrationContract.createCalibrationDefinition)
  createCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.createCalibrationDefinition).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("createCalibrationDefinition");

        const result = await this.createCalibrationDefinitionUseCase.execute(
          input,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "createCalibrationDefinition");
      },
    );
  }

  @CanAccess({ resource: "calibration_definition", action: "manage", param: "definitionId" })
  @Implement(iotCalibrationContract.deleteCalibrationDefinition)
  deleteCalibrationDefinition(@Session() session: UserSession) {
    return implement(iotCalibrationContract.deleteCalibrationDefinition).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("deleteCalibrationDefinition");

        const result = await this.deleteCalibrationDefinitionUseCase.execute(
          input.definitionId,
          session.user.id,
        );

        if (result.isSuccess()) {
          return;
        }

        return throwOrpcFailure(result, this.logger, "deleteCalibrationDefinition");
      },
    );
  }

  // "contribute": a run adds data about the device without altering it; writing coefficients stays "manage".
  @CanAccess({ resource: "device", action: "contribute", param: "deviceId" })
  @Implement(iotCalibrationContract.createCalibrationRun)
  createCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.createCalibrationRun).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("createCalibrationRun");

      const result = await this.createCalibrationRunUseCase.execute(input, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "createCalibrationRun");
    });
  }

  @CanAccess({ resource: "device", action: "contribute", param: "deviceId" })
  @Implement(iotCalibrationContract.createExternalCalibrationRun)
  createExternalCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.createExternalCalibrationRun).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("createExternalCalibrationRun");

        const result = await this.createExternalCalibrationRunUseCase.execute(
          input,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "createExternalCalibrationRun");
      },
    );
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotCalibrationContract.listDeviceCalibrationRuns)
  listDeviceCalibrationRuns(@Session() session: UserSession) {
    return implement(iotCalibrationContract.listDeviceCalibrationRuns).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("listDeviceCalibrationRuns");

        const result = await this.listDeviceCalibrationRunsUseCase.execute(input.deviceId);

        if (result.isSuccess()) {
          return formatDatesList(result.value);
        }

        return throwOrpcFailure(result, this.logger, "listDeviceCalibrationRuns");
      },
    );
  }

  @Implement(iotCalibrationContract.getCalibrationRun)
  getCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.getCalibrationRun).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getCalibrationRun");

      const result = await this.getCalibrationRunUseCase.execute(input.runId, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "getCalibrationRun");
    });
  }

  @Implement(iotCalibrationContract.approveCalibrationRun)
  approveCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.approveCalibrationRun).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("approveCalibrationRun");

      const result = await this.approveCalibrationRunUseCase.execute(input.runId, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "approveCalibrationRun");
    });
  }

  @Implement(iotCalibrationContract.rejectCalibrationRun)
  rejectCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.rejectCalibrationRun).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("rejectCalibrationRun");

      const result = await this.rejectCalibrationRunUseCase.execute(input.runId, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "rejectCalibrationRun");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotCalibrationContract.getActiveDeviceCalibration)
  getActiveDeviceCalibration(@Session() session: UserSession) {
    return implement(iotCalibrationContract.getActiveDeviceCalibration).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("getActiveDeviceCalibration");

        const result = await this.getActiveDeviceCalibrationUseCase.execute(input.deviceId);

        if (result.isSuccess()) {
          return result.value === null ? null : formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "getActiveDeviceCalibration");
      },
    );
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotCalibrationContract.listDeviceCalibrations)
  listDeviceCalibrations(@Session() session: UserSession) {
    return implement(iotCalibrationContract.listDeviceCalibrations).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("listDeviceCalibrations");

      const result = await this.listDeviceCalibrationsUseCase.execute(input.deviceId);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listDeviceCalibrations");
    });
  }

  @Implement(iotCalibrationContract.reportDeviceCalibrationWrite)
  reportDeviceCalibrationWrite(@Session() session: UserSession) {
    return implement(iotCalibrationContract.reportDeviceCalibrationWrite).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("reportDeviceCalibrationWrite");

        const result = await this.reportDeviceCalibrationWriteUseCase.execute(
          input,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger, "reportDeviceCalibrationWrite");
      },
    );
  }
}
