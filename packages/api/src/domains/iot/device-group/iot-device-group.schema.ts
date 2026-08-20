import { z } from "zod";

import { zResourceCapabilities } from "../../authorization/capabilities.schema";
import {
  zDeviceOnboardingConfig,
  zIotDeviceStatus,
  zDeviceType,
  zIssueIotCredentialsResponse,
  zMonitoringBucket,
} from "../iot.schema";

// Platform-native grouping: groups never mirror to AWS thing groups, whose
// quota stays reserved for the parked broker-enforcement design.
export const zIotDeviceGroup = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string().uuid().nullable(),
  visibility: z.enum(["private", "public"]),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zIotDeviceGroupListItem = zIotDeviceGroup.extend({
  memberCount: z.number().int(),
});

export const zIotDeviceGroupList = z.array(zIotDeviceGroupListItem);

// Detail carries capabilities like the other resource details: one `can()`
// resolution per resource, so lists stay plain.
export const zIotDeviceGroupDetail = zIotDeviceGroupListItem.extend({
  capabilities: zResourceCapabilities,
});

/**
 * Roster row: a shallow projection of a member device. Collaborators may see
 * members they could not read directly, so the row carries display fields
 * only; drill-through stays gated by the viewer's own device access.
 */
export const zIotDeviceGroupMember = z.object({
  deviceId: z.string().uuid(),
  name: z.string().nullable(),
  serialNumber: z.string(),
  deviceType: zDeviceType,
  status: zIotDeviceStatus,
  // Fleet-index connectivity; null when the index is unavailable, never a guess.
  connected: z.boolean().nullable(),
  addedAt: z.string().datetime(),
});

export const zIotDeviceGroupMemberList = z.array(zIotDeviceGroupMember);

/**
 * Health facts for one member. Verdicts (silent, X-of-Y rollups) are computed
 * client-side from these facts, with the same policy as the device page.
 */
export const zIotDeviceGroupMemberHealth = z.object({
  deviceId: z.string().uuid(),
  name: z.string().nullable(),
  serialNumber: z.string(),
  deviceType: zDeviceType,
  connectivity: z
    .object({
      connected: z.boolean(),
      lastSeenAt: z.string().datetime().nullable(),
    })
    .nullable(),
  lastDataAt: z.string().datetime().nullable(),
});

/** One (bucket, member) measurement count; deviceId null for unmapped rows. */
export const zIotDeviceGroupThroughputBucket = z.object({
  bucketStart: z.string().datetime().nullable(),
  deviceId: z.string().uuid().nullable(),
  count: z.number().int(),
});

/** One (bucket, experiment) measurement count aggregated across the group. */
export const zIotDeviceGroupExperimentBucket = z.object({
  bucketStart: z.string().datetime().nullable(),
  experimentId: z.string().uuid().nullable(),
  count: z.number().int(),
});

/** A member's most recent firmware version inside the window. */
export const zIotDeviceGroupFirmware = z.object({
  deviceId: z.string().uuid().nullable(),
  version: z.string().nullable(),
  lastSeen: z.string().datetime().nullable(),
});

/** A member's broker lifecycle event inside the window. */
export const zIotDeviceGroupLifecycleEvent = z.object({
  deviceId: z.string().uuid().nullable(),
  eventType: z.string().nullable(),
  eventTimestamp: z.string().datetime().nullable(),
  disconnectReason: z.string().nullable(),
});

export const zIotDeviceGroupMonitoring = z.object({
  members: z.array(zIotDeviceGroupMemberHealth),
  throughput: z.array(zIotDeviceGroupThroughputBucket),
  dataByExperiment: z.array(zIotDeviceGroupExperimentBucket),
  firmware: z.array(zIotDeviceGroupFirmware),
  events: z.array(zIotDeviceGroupLifecycleEvent),
  // Warehouse lookups failed: facts degrade to unknown, never to "silent".
  pipelineUnavailable: z.boolean(),
});

export const zCreateIotDeviceGroupBody = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  // Defaults to the creator's personal org; the caller must be a member.
  organizationId: z.string().uuid().optional(),
});

export const zUpdateIotDeviceGroupBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const zIotDeviceGroupPathParam = z.object({
  groupId: z.string().uuid(),
});

// Batch add: a selection is a transient group, so membership changes accept
// many devices in one call.
export const zAddIotDeviceGroupMembersBody = zIotDeviceGroupPathParam.extend({
  deviceIds: z.array(z.string().uuid()).min(1).max(100),
});

export const zRemoveIotDeviceGroupMemberParams = zIotDeviceGroupPathParam.extend({
  deviceId: z.string().uuid(),
});

/**
 * Batch onboarding: the group (or a member subset) binds to the same
 * experiments through the single-device executor, one device at a time. An
 * empty `experimentIds` re-issues every selected device's current config,
 * mirroring the single-device contract.
 */
export const zOnboardIotDeviceGroupBody = zIotDeviceGroupPathParam.extend({
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
export const zIotDeviceGroupOnboardRow = z.object({
  deviceId: z.string().uuid(),
  config: zDeviceOnboardingConfig.nullable(),
  error: z.string().nullable(),
});

export const zIotDeviceGroupOnboardResult = z.object({
  devices: z.array(zIotDeviceGroupOnboardRow),
});

/**
 * Batch credential lifecycle: the single-device executors run per member, so
 * per-device state guards surface as row errors. Omitted `deviceIds` means
 * every member; the cap mirrors the use-case batch guard.
 */
export const zIotDeviceGroupCredentialsBody = zIotDeviceGroupPathParam.extend({
  deviceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .optional()
    .describe("Member subset; omitted means every member"),
});

/** Per-device outcome; issued credentials are shown once, never re-readable. */
export const zIotDeviceGroupCredentialRow = z.object({
  deviceId: z.string().uuid(),
  // Null only when the row failed before resolving a member device.
  thingName: z.string().nullable(),
  credentials: zIssueIotCredentialsResponse.nullable(),
  error: z.string().nullable(),
});

export const zIotDeviceGroupCredentialsResult = z.object({
  devices: z.array(zIotDeviceGroupCredentialRow),
});

export const zIotDeviceGroupRevokeRow = z.object({
  deviceId: z.string().uuid(),
  error: z.string().nullable(),
});

export const zIotDeviceGroupRevokeResult = z.object({
  devices: z.array(zIotDeviceGroupRevokeRow),
});
/** Same window/bucket contract as the device dashboard, group-addressed. */
export const zIotDeviceGroupMonitoringQuery = zIotDeviceGroupPathParam
  .extend({
    from: z.string().datetime(),
    to: z.string().datetime(),
    bucket: zMonitoringBucket,
  })
  .refine((range) => new Date(range.from).getTime() < new Date(range.to).getTime(), {
    message: "from must be before to",
    path: ["from"],
  })
  // The UI presets top out at 30 days; an unbounded span would let one request
  // scan and return an arbitrarily large slice of the warehouse.
  .refine(
    (range) => new Date(range.to).getTime() - new Date(range.from).getTime() <= 31 * 86_400_000,
    { message: "range must not exceed 31 days", path: ["to"] },
  );

export type IotDeviceGroup = z.infer<typeof zIotDeviceGroup>;
export type IotDeviceGroupListItem = z.infer<typeof zIotDeviceGroupListItem>;
export type IotDeviceGroupDetail = z.infer<typeof zIotDeviceGroupDetail>;
export type IotDeviceGroupMember = z.infer<typeof zIotDeviceGroupMember>;
export type OnboardIotDeviceGroupBody = z.infer<typeof zOnboardIotDeviceGroupBody>;
export type IotDeviceGroupOnboardRow = z.infer<typeof zIotDeviceGroupOnboardRow>;
export type IotDeviceGroupOnboardResult = z.infer<typeof zIotDeviceGroupOnboardResult>;
export type IotDeviceGroupCredentialsBody = z.infer<typeof zIotDeviceGroupCredentialsBody>;
export type IotDeviceGroupCredentialRow = z.infer<typeof zIotDeviceGroupCredentialRow>;
export type IotDeviceGroupCredentialsResult = z.infer<typeof zIotDeviceGroupCredentialsResult>;
export type IotDeviceGroupRevokeRow = z.infer<typeof zIotDeviceGroupRevokeRow>;
export type IotDeviceGroupRevokeResult = z.infer<typeof zIotDeviceGroupRevokeResult>;
export type IotDeviceGroupMemberHealth = z.infer<typeof zIotDeviceGroupMemberHealth>;
export type IotDeviceGroupMonitoring = z.infer<typeof zIotDeviceGroupMonitoring>;
export type IotDeviceGroupThroughputBucket = z.infer<typeof zIotDeviceGroupThroughputBucket>;
export type IotDeviceGroupLifecycleEvent = z.infer<typeof zIotDeviceGroupLifecycleEvent>;
export type IotDeviceGroupExperimentBucket = z.infer<typeof zIotDeviceGroupExperimentBucket>;
export type IotDeviceGroupFirmware = z.infer<typeof zIotDeviceGroupFirmware>;
export type CreateIotDeviceGroupBody = z.infer<typeof zCreateIotDeviceGroupBody>;
export type UpdateIotDeviceGroupBody = z.infer<typeof zUpdateIotDeviceGroupBody>;
