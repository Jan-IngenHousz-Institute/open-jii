import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, ThingConnectivity } from "../../../core/ports/aws.port";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

export type IotDeviceWithConnectivityDto = IotDeviceDto & {
  connectivity: { connected: boolean; lastSeenAt: string | null } | null;
};

@Injectable()
export class ListIotDevicesUseCase {
  private readonly logger = new Logger(ListIotDevicesUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
  ) {}

  async execute(userId: string): Promise<Result<IotDeviceWithConnectivityDto[]>> {
    this.logger.log({
      msg: "Listing devices",
      operation: "listIotDevices",
      userId,
    });

    const devicesResult = await this.deviceRepository.listAccessible(userId);
    if (devicesResult.isFailure()) {
      return devicesResult;
    }

    const devices = devicesResult.value;
    const connectivity = await this.lookupConnectivity(devices.map((device) => device.thingName));

    return success(
      devices.map((device) => {
        const thing = connectivity?.get(device.thingName);
        return {
          ...device,
          connectivity: thing ? { connected: thing.connected, lastSeenAt: thing.lastSeenAt } : null,
        };
      }),
    );
  }

  // Connectivity is an enrichment, never a gate: a fleet-index failure (or an
  // index still building after first enable) degrades every device to an
  // unknown state instead of failing the list.
  private async lookupConnectivity(
    thingNames: string[],
  ): Promise<Map<string, ThingConnectivity> | null> {
    if (thingNames.length === 0) {
      return null;
    }

    const result = await this.awsPort.searchThingsConnectivity(thingNames);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Fleet-index connectivity lookup failed; devices render as unknown",
        operation: "listIotDevices",
        errorCode: result.error.code,
      });
      return null;
    }

    return result.value;
  }
}
