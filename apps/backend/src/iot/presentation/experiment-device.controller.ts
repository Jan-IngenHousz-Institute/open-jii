import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { experimentDevicesContract } from "@repo/api/domains/experiment/devices/experiment-devices.contract";
import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListDeviceExperimentsUseCase } from "../application/use-cases/list-device-experiments/list-device-experiments";
import { ListExperimentDevicesUseCase } from "../application/use-cases/list-experiment-devices/list-experiment-devices";
import { OnboardDeviceUseCase } from "../application/use-cases/onboard-device/onboard-device";
import { RemoveExperimentDeviceUseCase } from "../application/use-cases/remove-experiment-device/remove-experiment-device";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class ExperimentDeviceController {
  private readonly logger = new Logger(ExperimentDeviceController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly onboardDeviceUseCase: OnboardDeviceUseCase,
    private readonly listDeviceExperimentsUseCase: ListDeviceExperimentsUseCase,
    private readonly listExperimentDevicesUseCase: ListExperimentDevicesUseCase,
    private readonly removeExperimentDeviceUseCase: RemoveExperimentDeviceUseCase,
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

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.onboardDevice)
  onboardDevice(@Session() session: UserSession) {
    return implement(iotContract.onboardDevice).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("onboardDevice");

      const result = await this.onboardDeviceUseCase.execute(
        input.deviceId,
        input.experimentIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "onboardDevice");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.listDeviceExperiments)
  listDeviceExperiments(@Session() session: UserSession) {
    return implement(iotContract.listDeviceExperiments).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("listDeviceExperiments");

      const result = await this.listDeviceExperimentsUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listDeviceExperiments");
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDevicesContract.listExperimentDevices)
  listExperimentDevices(@Session() session: UserSession) {
    return implement(experimentDevicesContract.listExperimentDevices).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("listExperimentDevices");

      const result = await this.listExperimentDevicesUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listExperimentDevices");
    });
  }

  @Implement(experimentDevicesContract.removeExperimentDevice)
  removeExperimentDevice(@Session() session: UserSession) {
    return implement(experimentDevicesContract.removeExperimentDevice).handler(
      async ({ input }) => {
        if (!(await this.devicesEnabled(session))) this.disabled("removeExperimentDevice");

        const result = await this.removeExperimentDeviceUseCase.execute(
          input.id,
          input.deviceId,
          session.user.id,
        );

        if (result.isSuccess()) {
          return undefined;
        }

        return throwOrpcFailure(result, this.logger, "removeExperimentDevice");
      },
    );
  }
}
