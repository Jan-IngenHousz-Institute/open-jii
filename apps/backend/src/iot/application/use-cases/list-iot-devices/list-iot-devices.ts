import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

@Injectable()
export class ListIotDevicesUseCase {
  private readonly logger = new Logger(ListIotDevicesUseCase.name);

  constructor(private readonly deviceRepository: IotDeviceRepository) {}

  async execute(userId: string): Promise<Result<IotDeviceDto[]>> {
    this.logger.log({
      msg: "Listing devices",
      operation: "listIotDevices",
      userId,
    });

    return this.deviceRepository.listByOwner(userId);
  }
}
