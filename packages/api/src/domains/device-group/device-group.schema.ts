import { z } from "zod";

import { zResourceCapabilities } from "../authorization/capabilities.schema";
import { zDeviceOnboardingConfig, zIotDeviceStatus, zDeviceType } from "../iot/iot.schema";

// Platform-native grouping: groups never mirror to AWS thing groups, whose
// quota stays reserved for the parked broker-enforcement design.
export const zDeviceGroup = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid().nullable(),
  visibility: z.enum(["private", "public"]),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zDeviceGroupListItem = zDeviceGroup.extend({
  memberCount: z.number().int(),
});

export const zDeviceGroupList = z.array(zDeviceGroupListItem);

// Detail carries capabilities like the other resource details: one `can()`
// resolution per resource, so lists stay plain.
export const zDeviceGroupDetail = zDeviceGroupListItem.extend({
  capabilities: zResourceCapabilities,
});

/**
 * Roster row: a shallow projection of a member device. Collaborators may see
 * members they could not read directly, so the row carries display fields
 * only; drill-through stays gated by the viewer's own device access.
 */
export const zDeviceGroupMember = z.object({
  deviceId: z.string().uuid(),
  name: z.string().nullable(),
  serialNumber: z.string(),
  deviceType: zDeviceType,
  status: zIotDeviceStatus,
  addedAt: z.string().datetime(),
});

export const zDeviceGroupMemberList = z.array(zDeviceGroupMember);

export const zCreateDeviceGroupBody = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  // Defaults to the creator's personal org; the caller must be a member.
  organizationId: z.string().uuid().optional(),
});

export const zUpdateDeviceGroupBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const zDeviceGroupPathParam = z.object({
  groupId: z.string().uuid(),
});

// Batch add: a selection is a transient group, so membership changes accept
// many devices in one call.
export const zAddDeviceGroupMembersBody = zDeviceGroupPathParam.extend({
  deviceIds: z.array(z.string().uuid()).min(1).max(100),
});

export const zRemoveDeviceGroupMemberParams = zDeviceGroupPathParam.extend({
  deviceId: z.string().uuid(),
});

/**
 * Batch onboarding: the group (or a member subset) binds to the same
 * experiments through the single-device executor, one device at a time. An
 * empty `experimentIds` re-issues every selected device's current config,
 * mirroring the single-device contract.
 */
export const zOnboardDeviceGroupBody = zDeviceGroupPathParam.extend({
  experimentIds: z.array(z.string().uuid()).max(100).default([]),
  deviceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .optional()
    .describe("Member subset to onboard; omitted means every member"),
  includeWorkbook: z.boolean().default(true),
});

/** Per-device outcome; the batch itself succeeds even when single rows fail. */
export const zDeviceGroupOnboardRow = z.object({
  deviceId: z.string().uuid(),
  config: zDeviceOnboardingConfig.nullable(),
  error: z.string().nullable(),
});

export const zDeviceGroupOnboardResult = z.object({
  devices: z.array(zDeviceGroupOnboardRow),
});

export type DeviceGroup = z.infer<typeof zDeviceGroup>;
export type DeviceGroupListItem = z.infer<typeof zDeviceGroupListItem>;
export type DeviceGroupDetail = z.infer<typeof zDeviceGroupDetail>;
export type DeviceGroupMember = z.infer<typeof zDeviceGroupMember>;
export type OnboardDeviceGroupBody = z.infer<typeof zOnboardDeviceGroupBody>;
export type DeviceGroupOnboardRow = z.infer<typeof zDeviceGroupOnboardRow>;
export type DeviceGroupOnboardResult = z.infer<typeof zDeviceGroupOnboardResult>;
export type CreateDeviceGroupBody = z.infer<typeof zCreateDeviceGroupBody>;
export type UpdateDeviceGroupBody = z.infer<typeof zUpdateDeviceGroupBody>;
