import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
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

  @TsRestHandler(contract.iot.onboardDevice)
  onboardDevice(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.onboardDevice, async ({ params, body }) => {
      const result = await this.onboardDeviceUseCase.execute(
        params.deviceId,
        body.experimentIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: result.value };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.iot.listDeviceExperiments)
  listDeviceExperiments(@Session() session: UserSession) {
    return tsRestHandler(contract.iot.listDeviceExperiments, async ({ params }) => {
      const result = await this.listDeviceExperimentsUseCase.execute(
        params.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: formatDatesList(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.listExperimentDevices)
  listExperimentDevices(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExperimentDevices, async ({ params }) => {
      const result = await this.listExperimentDevicesUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: formatDatesList(result.value) };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.removeExperimentDevice)
  removeExperimentDevice(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.removeExperimentDevice, async ({ params }) => {
      const result = await this.removeExperimentDeviceUseCase.execute(
        params.id,
        params.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return { status: StatusCodes.NO_CONTENT as const, body: null };
      }

      return handleFailure(result, this.logger);
    });
  }
}
