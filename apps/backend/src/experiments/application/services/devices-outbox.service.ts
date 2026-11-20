import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import { DeviceRegistryWarehouseRepository } from "../../core/repositories/device-registry-warehouse.repository";
import { ExperimentDeviceRegistryRepository } from "../../core/repositories/experiment-device-registry.repository";
import type { RegisteredDevice } from "../../core/repositories/experiment-device-registry.repository";
import { ExperimentDataOutboxService } from "./experiment-data-outbox.service";

@Injectable()
export class DevicesOutboxService extends ExperimentDataOutboxService<RegisteredDevice> {
  constructor(
    private readonly devices: ExperimentDeviceRegistryRepository,
    private readonly warehouse: DeviceRegistryWarehouseRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<RegisteredDevice[]>> {
    return this.devices.findByIds(ids);
  }

  protected async merge(records: RegisteredDevice[]): Promise<Result<"merged" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "merged" => "merged");
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
