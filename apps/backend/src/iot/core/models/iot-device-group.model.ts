import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import type { iotDevices } from "@repo/database";
import { deviceGroups } from "@repo/database";

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

/** Shallow roster row: display fields only, drill-through stays device-gated. */
export interface IotDeviceGroupMemberDto {
  deviceId: string;
  name: string | null;
  serialNumber: string;
  deviceType: MemberDevice["deviceType"];
  status: MemberDevice["status"];
  addedAt: Date;
}
