import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import type { iotDevices } from "@repo/database";
import { deviceGroups } from "@repo/database";

import type { CertificateResult } from "../ports/aws.port";

export const createIotDeviceGroupSchema = createInsertSchema(deviceGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  organizationId: true,
});

export const updateIotDeviceGroupSchema = createIotDeviceGroupSchema.partial();

export const selectIotDeviceGroupSchema = createSelectSchema(deviceGroups);

export type CreateIotDeviceGroupDto = z.infer<typeof createIotDeviceGroupSchema>;
export type UpdateIotDeviceGroupDto = z.infer<typeof updateIotDeviceGroupSchema>;
export type IotDeviceGroupDto = z.infer<typeof selectIotDeviceGroupSchema>;

/** Group row plus its member count, the list and detail projection. */
export type IotDeviceGroupWithCountDto = IotDeviceGroupDto & { memberCount: number };

type MemberDevice = typeof iotDevices.$inferSelect;

/** Monitoring projection: member identity plus the AWS/warehouse join key. */
export interface IotDeviceGroupMemberThingDto {
  deviceId: string;
  name: string | null;
  serialNumber: string;
  deviceType: MemberDevice["deviceType"];
  thingName: string;
}

/** Shallow roster row: display fields only, drill-through stays device-gated. */
export interface IotDeviceGroupMemberDto {
  deviceId: string;
  name: string | null;
  serialNumber: string;
  deviceType: MemberDevice["deviceType"];
  status: MemberDevice["status"];
  addedAt: Date;
}

/** Repo roster row: member plus the fleet-index key, stripped before the contract. */
export interface IotDeviceGroupMemberRecordDto extends IotDeviceGroupMemberDto {
  thingName: string;
}

/** Roster row enriched with connectivity; null means the fleet index was unavailable. */
export interface IotDeviceGroupMemberConnectivityDto extends IotDeviceGroupMemberDto {
  connected: boolean | null;
}

/** Per-device batch outcome; the batch itself succeeds even when rows fail. */
export interface IotDeviceGroupCredentialRowDto {
  deviceId: string;
  thingName: string | null;
  credentials: CertificateResult | null;
  error: string | null;
}

export interface IotDeviceGroupCredentialsDto {
  devices: IotDeviceGroupCredentialRowDto[];
}

export interface IotDeviceGroupRevokeRowDto {
  deviceId: string;
  error: string | null;
}

export interface IotDeviceGroupRevokeDto {
  devices: IotDeviceGroupRevokeRowDto[];
}
