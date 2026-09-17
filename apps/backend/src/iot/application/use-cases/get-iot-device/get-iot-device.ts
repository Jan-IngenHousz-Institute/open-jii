import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import type { IotDeviceWithConnectivityDto } from "../list-iot-devices/list-iot-devices";

@Injectable()
export class GetIotDeviceUseCase {
  private readonly logger = new Logger(GetIotDeviceUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(deviceId: string, userId: string): Promise<Result<IotDeviceWithConnectivityDto>> {
    this.logger.log({
      msg: "Getting device",
      operation: "getIotDevice",
      deviceId,
      userId,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }

    const device = deviceResult.value;
    const bindingsResult = await this.experimentDeviceRepository.countByDevices([device.id]);
    if (bindingsResult.isFailure()) {
      return failure(bindingsResult.error);
    }
    const boundExperimentCount = bindingsResult.value.get(device.id) ?? 0;

    // Connectivity is an enrichment, never a gate: on a fleet-index failure the
    // device renders with an unknown connectivity state.
    const connectivityResult = await this.awsPort.searchThingsConnectivity([device.thingName]);
    if (connectivityResult.isFailure()) {
      this.logger.warn({
        msg: "Fleet-index connectivity lookup failed; device renders as unknown",
        operation: "getIotDevice",
        deviceId,
        errorCode: connectivityResult.error.code,
      });
      return success({ ...device, connectivity: null, boundExperimentCount });
    }

    const thing = connectivityResult.value.get(device.thingName);
    return success({
      ...device,
      connectivity: thing ? { connected: thing.connected, lastSeenAt: thing.lastSeenAt } : null,
      boundExperimentCount,
    });
  }
}
