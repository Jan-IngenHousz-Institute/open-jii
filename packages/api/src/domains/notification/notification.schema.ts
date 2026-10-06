import { z } from "zod";

import { zPaginated } from "../../shared/listing";

export const zNotificationCategory = z.enum([
  "requests_and_invitations",
  "membership_and_access",
  "experiments_and_resources",
  "devices_and_calibration",
  "project_transfers",
  "data_jobs",
  "account_security",
]);

export const zNotificationChannel = z.enum(["email"]);

export const zNotificationResourceType = z.enum([
  "experiment",
  "macro",
  "protocol",
  "workbook",
  "device",
  "device_group",
  "calibration_definition",
  "organization",
]);

export const zNotificationType = z.enum([
  "experiment_join_request_received",
  "organization_join_request_received",
  "organization_invitation_received",
  "experiment_join_request_approved",
  "experiment_join_request_rejected",
  "organization_join_request_approved",
  "organization_join_request_rejected",
  "organization_invitation_accepted",
  "organization_role_changed",
  "organization_membership_removed",
  "experiment_invitation_accepted",
  "experiment_joined_with_code",
  "resource_member_left",
  "resource_access_granted",
  "resource_access_changed",
  "resource_access_revoked",
  "experiment_made_public",
  "resource_deleted",
  "resource_moved_organization",
  "workbook_version_published",
  "calibration_run_awaiting_approval",
  "calibration_run_approved",
  "calibration_run_rejected",
  "project_transfer_requested",
  "project_transfer_completed",
  "data_export_completed",
  "data_export_failed",
  "data_upload_completed",
  "data_upload_failed",
  "api_key_created",
  "passkey_added",
]);

export type NotificationType = z.infer<typeof zNotificationType>;
export type NotificationCategory = z.infer<typeof zNotificationCategory>;
export type NotificationChannel = z.infer<typeof zNotificationChannel>;
export type NotificationResourceType = z.infer<typeof zNotificationResourceType>;

/**
 * Whether a type also goes out on a channel: never, when the recipient's category
 * preference allows it, or always, whatever the preference says.
 */
export type NotificationChannelPolicy = "never" | "preference" | "always";

interface NotificationTypeDefinition {
  category: NotificationCategory;
  channels: Record<NotificationChannel, NotificationChannelPolicy>;
  /**
   * The display values a producer must capture when the event happens. Optional
   * values are for what the event may not carry, such as a requester's message.
   */
  params: z.ZodObject<Record<string, z.ZodString | z.ZodOptional<z.ZodString>>>;
}

const experiment = z.object({ experimentName: z.string() });
const organization = z.object({ organizationName: z.string() });
const resource = z.object({ resourceName: z.string() });
const calibration = z.object({ deviceName: z.string(), definitionName: z.string() });

/**
 * The single place a notification type is defined. Adding a type means an entry
 * here, a line of copy in the `notifications` i18n namespace, and the producer
 * that dispatches it; the compiler points at every other table keyed by type.
 * Adding a channel means a value in `zNotificationChannel`, after which every
 * type and category here must say what it does on it.
 */
export const NOTIFICATION_TYPES = {
  experiment_join_request_received: {
    category: "requests_and_invitations",
    channels: { email: "preference" },
    // The requester's message rides along because the email needs it; the bell does not show it.
    params: experiment.extend({ message: z.string().optional() }),
  },
  organization_join_request_received: {
    category: "requests_and_invitations",
    channels: { email: "preference" },
    // As on the experiment type: the email carries the requester's message, the bell does not.
    params: organization.extend({ message: z.string().optional() }),
  },
  organization_invitation_received: {
    category: "requests_and_invitations",
    channels: { email: "preference" },
    params: organization.extend({ role: z.string() }),
  },
  experiment_join_request_approved: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: experiment,
  },
  experiment_join_request_rejected: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: experiment,
  },
  organization_join_request_approved: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: organization,
  },
  organization_join_request_rejected: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: organization,
  },
  organization_invitation_accepted: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: organization,
  },
  organization_role_changed: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: organization.extend({ role: z.string() }),
  },
  organization_membership_removed: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: organization,
  },
  experiment_invitation_accepted: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: experiment,
  },
  experiment_joined_with_code: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: experiment,
  },
  resource_member_left: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: resource,
  },
  resource_access_granted: {
    category: "membership_and_access",
    channels: { email: "preference" },
    params: resource.extend({ role: z.string() }),
  },
  resource_access_changed: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: resource.extend({ role: z.string() }),
  },
  resource_access_revoked: {
    category: "membership_and_access",
    channels: { email: "never" },
    params: resource,
  },
  experiment_made_public: {
    category: "experiments_and_resources",
    channels: { email: "preference" },
    params: experiment,
  },
  resource_deleted: {
    category: "experiments_and_resources",
    channels: { email: "preference" },
    params: resource,
  },
  resource_moved_organization: {
    category: "experiments_and_resources",
    channels: { email: "never" },
    params: resource.extend({ organizationName: z.string() }),
  },
  workbook_version_published: {
    category: "experiments_and_resources",
    channels: { email: "never" },
    params: experiment.extend({ workbookName: z.string(), version: z.string() }),
  },
  calibration_run_awaiting_approval: {
    category: "devices_and_calibration",
    channels: { email: "preference" },
    params: calibration,
  },
  calibration_run_approved: {
    category: "devices_and_calibration",
    channels: { email: "preference" },
    params: calibration,
  },
  calibration_run_rejected: {
    category: "devices_and_calibration",
    channels: { email: "preference" },
    params: calibration,
  },
  project_transfer_requested: {
    category: "project_transfers",
    channels: { email: "preference" },
    params: z.object({ projectId: z.string() }),
  },
  project_transfer_completed: {
    category: "project_transfers",
    channels: { email: "preference" },
    params: experiment,
  },
  data_export_completed: {
    category: "data_jobs",
    channels: { email: "preference" },
    params: experiment.extend({ format: z.string() }),
  },
  data_export_failed: {
    category: "data_jobs",
    channels: { email: "preference" },
    params: experiment,
  },
  data_upload_completed: {
    category: "data_jobs",
    channels: { email: "preference" },
    params: experiment,
  },
  data_upload_failed: {
    category: "data_jobs",
    channels: { email: "preference" },
    params: experiment.extend({ fileName: z.string() }),
  },
  api_key_created: {
    category: "account_security",
    channels: { email: "always" },
    params: z.object({ keyName: z.string() }),
  },
  passkey_added: {
    category: "account_security",
    channels: { email: "always" },
    params: z.object({ passkeyName: z.string() }),
  },
} satisfies Record<NotificationType, NotificationTypeDefinition>;

export type NotificationParams<T extends NotificationType> = z.infer<
  (typeof NOTIFICATION_TYPES)[T]["params"]
>;

interface NotificationChannelDefault {
  enabled: boolean;
  /** A locked channel cannot be turned off for the category. */
  locked: boolean;
}

/** Applies until a person saves a preference for the category and channel. */
export const NOTIFICATION_CATEGORIES: Record<
  NotificationCategory,
  Record<NotificationChannel, NotificationChannelDefault>
> = {
  requests_and_invitations: { email: { enabled: true, locked: false } },
  membership_and_access: { email: { enabled: true, locked: false } },
  experiments_and_resources: { email: { enabled: true, locked: false } },
  devices_and_calibration: { email: { enabled: true, locked: false } },
  project_transfers: { email: { enabled: true, locked: false } },
  data_jobs: { email: { enabled: false, locked: false } },
  account_security: { email: { enabled: true, locked: true } },
};

export const zNotification = z.object({
  id: z.string().uuid(),
  type: zNotificationType,
  category: zNotificationCategory,
  actor: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  resource: z.object({ type: zNotificationResourceType, id: z.string().uuid() }).nullable(),
  params: z
    .record(z.string(), z.string())
    .describe("Display values captured when the event happened, such as the experiment name"),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const zListNotificationsQuery = z.object({
  readState: z.enum(["all", "unread"]).optional().describe("Defaults to all"),
  category: zNotificationCategory.optional(),
  page: z.coerce.number().int().min(1).optional().describe("1-based page number"),
  pageSize: z.coerce.number().int().min(1).max(50).optional().describe("Rows per page"),
});

export const zNotificationList = zPaginated(zNotification);

export const zUnreadNotificationCount = z.object({
  count: z.number().int().min(0),
});

export const zMarkNotificationsReadBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const zMarkNotificationsReadResponse = z.object({
  updated: z.number().int().min(0),
});

export const zNotificationPreference = z.object({
  category: zNotificationCategory,
  channel: zNotificationChannel,
  enabled: z.boolean(),
  locked: z.boolean(),
});

export const zNotificationPreferences = z.object({
  preferences: z.array(zNotificationPreference),
});

export const zUpdateNotificationPreferenceBody = z.object({
  category: zNotificationCategory,
  channel: zNotificationChannel,
  enabled: z.boolean(),
});

export type Notification = z.infer<typeof zNotification>;
export type ListNotificationsQuery = z.infer<typeof zListNotificationsQuery>;
export type NotificationList = z.infer<typeof zNotificationList>;
export type NotificationPreference = z.infer<typeof zNotificationPreference>;
export type NotificationPreferences = z.infer<typeof zNotificationPreferences>;
export type UpdateNotificationPreferenceBody = z.infer<typeof zUpdateNotificationPreferenceBody>;
