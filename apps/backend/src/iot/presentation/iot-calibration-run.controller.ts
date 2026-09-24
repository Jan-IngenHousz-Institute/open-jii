import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { iotCalibrationContract } from "@repo/api/domains/iot/calibration/iot-calibration.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ApproveCalibrationRunUseCase } from "../application/use-cases/approve-calibration-run/approve-calibration-run";
import { CreateCalibrationRunUseCase } from "../application/use-cases/create-calibration-run/create-calibration-run";
import { CreateExternalCalibrationRunUseCase } from "../application/use-cases/create-external-calibration-run/create-external-calibration-run";
import { GetActiveDeviceCalibrationUseCase } from "../application/use-cases/get-active-device-calibration/get-active-device-calibration";
import { GetCalibrationRunUseCase } from "../application/use-cases/get-calibration-run/get-calibration-run";
import { ListDeviceCalibrationRunsUseCase } from "../application/use-cases/list-device-calibration-runs/list-device-calibration-runs";
import { ListDeviceCalibrationsUseCase } from "../application/use-cases/list-device-calibrations/list-device-calibrations";
import { RejectCalibrationRunUseCase } from "../application/use-cases/reject-calibration-run/reject-calibration-run";
import { ReportDeviceCalibrationWriteUseCase } from "../application/use-cases/report-device-calibration-write/report-device-calibration-write";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class IotCalibrationRunController {
  private readonly logger = new Logger(IotCalibrationRunController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
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

  // "contribute": a run adds data about the device without altering it; writing coefficients stays "manage".
  @CanAccess({ resource: "device", action: "contribute", param: "deviceId" })
  @Implement(iotCalibrationContract.createCalibrationRun)
  createCalibrationRun(@Session() session: UserSession) {
    return implement(iotCalibrationContract.createCalibrationRun).handler(async ({ input }) => {
      await this.requireCalibration(session, "createCalibrationRun");

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
        await this.requireCalibration(session, "createExternalCalibrationRun");

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
        await this.requireCalibration(session, "listDeviceCalibrationRuns");

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
      await this.requireCalibration(session, "getCalibrationRun");

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
      await this.requireCalibration(session, "approveCalibrationRun");

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
      await this.requireCalibration(session, "rejectCalibrationRun");

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
        await this.requireCalibration(session, "getActiveDeviceCalibration");

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
      await this.requireCalibration(session, "listDeviceCalibrations");

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
        await this.requireCalibration(session, "reportDeviceCalibrationWrite");

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

  /** Calibration stays dark until PostHog targets someone, so every call is refused until then. */
  private async requireCalibration(session: UserSession, operation: string): Promise<void> {
    const isEnabled = await this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.CALIBRATION,
      session.user.email || session.user.id,
    );

    if (!isEnabled) {
      throwOrpcError(
        AppError.forbidden("Calibration is currently disabled"),
        this.logger,
        operation,
      );
    }
  }
}
