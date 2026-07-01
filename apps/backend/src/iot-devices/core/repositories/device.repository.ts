export const DEVICE_REPOSITORY = Symbol("DEVICE_REPOSITORY");

export interface DeviceRecord {
  id: string;
  thingName: string;
  serialNumber: string;
  deviceClass: string;
  certificateId: string;
  certificateArn: string;
  status: "active" | "rotating" | "revoked";
  ownerUserId: string | null;
  provisionedAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceRepository {
  findByThingName(thingName: string): Promise<DeviceRecord | null>;
  findBySerialNumber(serialNumber: string): Promise<DeviceRecord | null>;
  findAll(): Promise<DeviceRecord[]>;
  create(data: {
    thingName: string;
    serialNumber: string;
    deviceClass: string;
    certificateId: string;
    certificateArn: string;
    ownerUserId?: string;
  }): Promise<DeviceRecord>;
  updateCertificate(
    thingName: string,
    certificateId: string,
    certificateArn: string,
  ): Promise<DeviceRecord>;
  updateStatus(thingName: string, status: "active" | "rotating" | "revoked"): Promise<DeviceRecord>;
}
