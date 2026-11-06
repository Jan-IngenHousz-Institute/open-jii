import { Inject, Injectable } from "@nestjs/common";

import { inArray, iotDevices } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

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
 * The registry's devices by the client id they publish under, which is their thing name, the way
 * the pipelines resolve them through the device registry webhook.
 */
@Injectable()
export class ExperimentDeviceRegistryRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async findByThingNames(thingNames: string[]): Promise<Result<RegisteredDevice[]>> {
    return tryCatch(async (): Promise<RegisteredDevice[]> => {
      if (thingNames.length === 0) {
        return [];
      }
      return await this.database
        .select({
          thingName: iotDevices.thingName,
          id: iotDevices.id,
          serialNumber: iotDevices.serialNumber,
          createdBy: iotDevices.createdBy,
          status: iotDevices.status,
          deviceType: iotDevices.deviceType,
        })
        .from(iotDevices)
        .where(inArray(iotDevices.thingName, thingNames));
    });
  }
}
