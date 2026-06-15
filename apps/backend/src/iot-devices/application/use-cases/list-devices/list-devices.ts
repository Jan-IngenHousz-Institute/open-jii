import { Inject, Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import { success } from "../../../../common/utils/fp-utils";
import { DEVICE_REPOSITORY } from "../../../core/repositories/device.repository";
import type { DeviceRecord, DeviceRepository } from "../../../core/repositories/device.repository";

@Injectable()
export class ListDevicesUseCase {
  private readonly logger = new Logger(ListDevicesUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async execute(): Promise<Result<DeviceRecord[]>> {
    this.logger.log({ msg: "Listing devices" });
    const devices = await this.deviceRepository.findAll();
    return success(devices);
  }
}
