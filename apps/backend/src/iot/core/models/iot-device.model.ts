import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { iotDevices } from "@repo/database";

export const createIotDeviceSchema = createInsertSchema(iotDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const selectIotDeviceSchema = createSelectSchema(iotDevices);

export type CreateIotDeviceDto = z.infer<typeof createIotDeviceSchema>;
export type IotDeviceDto = z.infer<typeof selectIotDeviceSchema>;

export type UpdateIotDeviceDto = Partial<
  Pick<IotDeviceDto, "status" | "certificateId" | "certificateArn" | "name">
>;
