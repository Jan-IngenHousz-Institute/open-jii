import { Inject, Injectable } from "@nestjs/common";

import { inArray, iotDevices } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";

/** A registered device as an experiment's rows show it. */
export interface RegisteredDevice {
  thingName: string;
  id: string;
  serialNumber: string;
  createdBy: string | null;
  status: string;
  deviceType: string;
}

/**
 * The registry's devices as an experiment's rows name them, by the client id they publish under,
 * which is their thing name, the key the pipelines join the registry's lakehouse copy on.
 */
@Injectable()
export class ExperimentDeviceRegistryRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async findByThingNames(thingNames: string[]): Promise<Result<RegisteredDevice[]>> {
    return tryCatch(async (): Promise<RegisteredDevice[]> => {
      if (thingNames.length === 0) {
        return [];
      }
      return await this.select(inArray(iotDevices.thingName, thingNames));
    });
  }

  async findByIds(ids: string[]): Promise<Result<RegisteredDevice[]>> {
    return tryCatch(() => this.select(inArray(iotDevices.id, ids)));
  }

  private async select(condition: SQL): Promise<RegisteredDevice[]> {
    return this.database
      .select({
        thingName: iotDevices.thingName,
        id: iotDevices.id,
        serialNumber: iotDevices.serialNumber,
        createdBy: iotDevices.createdBy,
        status: iotDevices.status,
        deviceType: iotDevices.deviceType,
      })
      .from(iotDevices)
      .where(condition);
  }
}
