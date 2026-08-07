import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentDevicesContract } from "@repo/api/domains/experiment/devices/experiment-devices.contract";
import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListDeviceExperimentsUseCase } from "../application/use-cases/list-device-experiments/list-device-experiments";
import { ListExperimentDevicesUseCase } from "../application/use-cases/list-experiment-devices/list-experiment-devices";
import { OnboardDeviceUseCase } from "../application/use-cases/onboard-device/onboard-device";
import { RemoveExperimentDeviceUseCase } from "../application/use-cases/remove-experiment-device/remove-experiment-device";

@Controller()
export class ExperimentDeviceController {
  private readonly logger = new Logger(ExperimentDeviceController.name);

  constructor(
    private readonly onboardDeviceUseCase: OnboardDeviceUseCase,
    private readonly listDeviceExperimentsUseCase: ListDeviceExperimentsUseCase,
    private readonly listExperimentDevicesUseCase: ListExperimentDevicesUseCase,
    private readonly removeExperimentDeviceUseCase: RemoveExperimentDeviceUseCase,
  ) {}

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.onboardDevice)
  onboardDevice(@Session() session: UserSession) {
    return implement(iotContract.onboardDevice).handler(async ({ input }) => {
      const result = await this.onboardDeviceUseCase.execute(
        input.deviceId,
        input.experimentIds,
        session.user.id,
        input.includeWorkbook,
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
