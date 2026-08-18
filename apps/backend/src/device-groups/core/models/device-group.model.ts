import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import type { iotDevices } from "@repo/database";
import { deviceGroups } from "@repo/database";

export const createDeviceGroupSchema = createInsertSchema(deviceGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  organizationId: true,
});

export const updateDeviceGroupSchema = createDeviceGroupSchema.partial();

export const selectDeviceGroupSchema = createSelectSchema(deviceGroups);

export type CreateDeviceGroupDto = z.infer<typeof createDeviceGroupSchema>;
export type UpdateDeviceGroupDto = z.infer<typeof updateDeviceGroupSchema>;
export type DeviceGroupDto = z.infer<typeof selectDeviceGroupSchema>;

/** Group row plus its member count, the list and detail projection. */
export type DeviceGroupWithCountDto = DeviceGroupDto & { memberCount: number };

type MemberDevice = typeof iotDevices.$inferSelect;

/** Shallow roster row: display fields only, drill-through stays device-gated. */
export interface DeviceGroupMemberDto {
  deviceId: string;
  name: string | null;
  serialNumber: string;
  deviceType: MemberDevice["deviceType"];
  status: MemberDevice["status"];
  addedAt: Date;
}
