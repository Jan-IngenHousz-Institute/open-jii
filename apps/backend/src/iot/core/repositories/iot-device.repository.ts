import { Injectable, Inject } from "@nestjs/common";

import { and, desc, eq, iotDevices } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { CreateIotDeviceDto, IotDeviceDto, UpdateIotDeviceDto } from "../models/iot-device.model";

@Injectable()
export class IotDeviceRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createIotDeviceDto: CreateIotDeviceDto,
    userId: string,
  ): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .insert(iotDevices)
        .values({ ...createIotDeviceDto, createdBy: userId })
        .returning();
      return results;
    });
  }

  async listByOwner(userId: string): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.createdBy, userId))
        .orderBy(desc(iotDevices.createdAt));
      return results;
    });
  }

  async findByIdForOwner(deviceId: string, userId: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(and(eq(iotDevices.id, deviceId), eq(iotDevices.createdBy, userId)))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  async findBySerialNumber(serialNumber: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.serialNumber, serialNumber))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  async update(
    deviceId: string,
    userId: string,
    patch: UpdateIotDeviceDto,
  ): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(iotDevices)
        .set(patch)
        .where(and(eq(iotDevices.id, deviceId), eq(iotDevices.createdBy, userId)))
        .returning();
      return results.length === 0 ? null : results[0];
    });
  }

  async delete(deviceId: string, userId: string): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .delete(iotDevices)
        .where(and(eq(iotDevices.id, deviceId), eq(iotDevices.createdBy, userId)))
        .returning();
      return results;
    });
  }
}
