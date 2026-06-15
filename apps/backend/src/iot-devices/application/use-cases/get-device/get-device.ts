import { Inject, Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRecord, DeviceRepository } from "../../../core/repositories/device.repository";

@Injectable()
export class GetDeviceUseCase {
  private readonly logger = new Logger(GetDeviceUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(thingName: string): Promise<Result<DeviceRecord>> {
    this.logger.log({ msg: "Getting device", thingName });
    const device = await this.deviceRepository.findByThingName(thingName);
    if (!device) return failure(AppError.notFound(`Device ${thingName} not found`));
    return success(device);
  }
}
