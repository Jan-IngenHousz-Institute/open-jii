import { Inject, Injectable } from "@nestjs/common";

import { eq, iotDevices } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import type { DeviceRecord, DeviceRepository } from "../../core/repositories/device.repository";

@Injectable()
export class DrizzleDeviceRepository implements DeviceRepository {
  constructor(
    @Inject("DATABASE")
    private readonly db: DatabaseInstance,
  ) {}

  async findByThingName(thingName: string): Promise<DeviceRecord | null> {
    const rows = await this.db
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.thingName, thingName))
      .limit(1);
    return rows.length > 0 ? (rows[0] as DeviceRecord) : null;
  }

  async findBySerialNumber(serialNumber: string): Promise<DeviceRecord | null> {
    const rows = await this.db
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.serialNumber, serialNumber))
      .limit(1);
    return rows.length > 0 ? (rows[0] as DeviceRecord) : null;
  }

  async findAll(): Promise<DeviceRecord[]> {
    return this.db.select().from(iotDevices) as Promise<DeviceRecord[]>;
  }

  async create(data: {
    thingName: string;
    serialNumber: string;
    deviceClass: string;
    certificateId: string;
    certificateArn: string;
    ownerUserId?: string;
  }): Promise<DeviceRecord> {
    const rows = await this.db.insert(iotDevices).values(data).returning();
    return rows[0] as DeviceRecord;
  }

  async updateCertificate(
    thingName: string,
    certificateId: string,
    certificateArn: string,
  ): Promise<DeviceRecord> {
    const rows = await this.db
      .update(iotDevices)
      .set({ certificateId, certificateArn, rotatedAt: new Date() })
      .where(eq(iotDevices.thingName, thingName))
      .returning();
    return rows[0] as DeviceRecord;
  }

  async updateStatus(
    thingName: string,
    status: "active" | "rotating" | "revoked",
  ): Promise<DeviceRecord> {
    const extra: Partial<typeof iotDevices.$inferInsert> =
      status === "revoked" ? { revokedAt: new Date() } : {};
    const rows = await this.db
      .update(iotDevices)
      .set({ status, ...extra })
      .where(eq(iotDevices.thingName, thingName))
      .returning();
    return rows[0] as DeviceRecord;
  }
}
