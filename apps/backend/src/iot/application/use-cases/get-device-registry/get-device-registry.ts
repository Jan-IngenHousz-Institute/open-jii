import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

export interface GetDeviceRegistryParams {
  thingNames: string[];
}

@Injectable()
export class GetDeviceRegistryUseCase {
  private readonly logger = new Logger(GetDeviceRegistryUseCase.name);

  constructor(private readonly deviceRepository: IotDeviceRepository) {}

  async execute(params: GetDeviceRegistryParams): Promise<Result<IotDeviceDto[]>> {
    this.logger.log({
      msg: "Resolving device registry for lineage",
      operation: "getDeviceRegistry",
      thingNameCount: params.thingNames.length,
    });

    return await this.deviceRepository.findByThingNames(params.thingNames);
  }
}
