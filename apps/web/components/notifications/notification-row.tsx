"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { LocalTime } from "@/components/shared/local-time";
import { useLocale } from "@/hooks/useLocale";
import {
  ArrowRightLeft,
  BookOpen,
  Building2,
  CircleCheck,
  CircleX,
  Database,
  Fingerprint,
  FolderInput,
  Gauge,
  Globe,
  KeyRound,
  QrCode,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  Notification,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

type NotificationResource = Notification["resource"];

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  experiment_join_request_received: UserPlus,
  organization_join_request_received: UserPlus,
  organization_invitation_received: Building2,
  experiment_join_request_approved: CircleCheck,
  experiment_join_request_rejected: CircleX,
  organization_join_request_approved: CircleCheck,
  organization_join_request_rejected: CircleX,
  organization_invitation_accepted: UserCheck,
  organization_role_changed: UserCog,
  organization_membership_removed: UserMinus,
  experiment_invitation_accepted: UserCheck,
  experiment_joined_with_code: QrCode,
  resource_member_left: UserMinus,
  resource_access_granted: KeyRound,
  resource_access_changed: UserCog,
  resource_access_revoked: UserMinus,
  experiment_made_public: Globe,
  resource_deleted: Trash2,
  resource_moved_organization: FolderInput,
  workbook_version_published: BookOpen,
  calibration_run_awaiting_approval: Gauge,
  calibration_run_approved: CircleCheck,
  calibration_run_rejected: CircleX,
  project_transfer_requested: ArrowRightLeft,
  project_transfer_completed: ArrowRightLeft,
  data_export_completed: Database,
  data_export_failed: Database,
  data_upload_completed: Upload,
  data_upload_failed: Upload,
  api_key_created: KeyRound,
  passkey_added: Fingerprint,
};

// Resource types with no platform page of their own are absent, which reads as "no link".
const RESOURCE_SEGMENT: Partial<Record<NotificationResourceType, string>> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
  device: "devices",
  organization: "organizations",
};

const resourcePage = (resource: NotificationResource) => {
  const segment = resource ? RESOURCE_SEGMENT[resource.type] : undefined;
  return resource && segment ? `${segment}/${resource.id}` : null;
};

const resourceSubpage = (page: string) => (resource: NotificationResource) => {
  const base = resourcePage(resource);
  return base ? `${base}/${page}` : null;
};

const fixedPage = (path: string) => () => path;
const noPage = () => null;

/** Where a notification leads, relative to `/platform`. Null renders the row as plain text. */
const TYPE_PATH: Record<NotificationType, (resource: NotificationResource) => string | null> = {
  experiment_join_request_received: resourceSubpage("collaborators"),
  organization_join_request_received: resourceSubpage("members"),
  organization_invitation_received: fixedPage("account/invitations"),
  experiment_join_request_approved: resourcePage,
  // A declined request leaves nothing the requester may open.
  experiment_join_request_rejected: noPage,
  organization_join_request_approved: resourcePage,
  organization_join_request_rejected: noPage,
  organization_invitation_accepted: resourceSubpage("members"),
  organization_role_changed: resourcePage,
  organization_membership_removed: noPage,
  experiment_invitation_accepted: resourceSubpage("collaborators"),
  experiment_joined_with_code: resourceSubpage("collaborators"),
  resource_member_left: resourceSubpage("collaborators"),
  resource_access_granted: resourcePage,
  resource_access_changed: resourcePage,
  resource_access_revoked: noPage,
  experiment_made_public: resourcePage,
  resource_deleted: noPage,
  resource_moved_organization: resourcePage,
  workbook_version_published: resourceSubpage("design"),
  calibration_run_awaiting_approval: resourceSubpage("calibration"),
  calibration_run_approved: resourceSubpage("calibration"),
  calibration_run_rejected: resourceSubpage("calibration"),
  project_transfer_requested: fixedPage("transfer-request/history"),
  project_transfer_completed: resourcePage,
  data_export_completed: resourceSubpage("data"),
  data_export_failed: resourceSubpage("data"),
  data_upload_completed: resourceSubpage("data"),
  data_upload_failed: resourceSubpage("data"),
  api_key_created: fixedPage("account/api-keys"),
  passkey_added: fixedPage("account/security"),
};

interface NotificationRowProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

export function NotificationRow({ notification, onOpen }: NotificationRowProps) {
  const { t } = useTranslation("notifications");
  const locale = useLocale();

  const Icon = TYPE_ICON[notification.type];
  const path = TYPE_PATH[notification.type](notification.resource);
  const isUnread = notification.readAt === null;
  // `replace` keeps stored params apart from i18next's own options, so a future param
  // named `count` or `context` interpolates instead of changing how `t` behaves.
  const message = t(`types.${notification.type}`, {
    replace: { ...notification.params, actor: notification.actor?.name ?? t("someone") },
  });

  const handleOpen = () => onOpen(notification);
  const rowClass =
    "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden flex w-full items-start gap-3 px-4 py-3 text-left transition-colors";

  const content = (
    <>
      <span
        aria-hidden="true"
        data-testid={isUnread ? "notification-unread-dot" : undefined}
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", isUnread && "bg-primary")}
      />
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", isUnread ? "font-medium" : "text-muted-foreground")}>
          {message}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          <LocalTime value={notification.createdAt} locale={locale} isRelative />
        </p>
      </div>
    </>
  );

  if (path) {
    return (
      <IntentLink href={`/${locale}/platform/${path}`} onClick={handleOpen} className={rowClass}>
        {content}
      </IntentLink>
    );
  }

  return (
    <button type="button" onClick={handleOpen} className={rowClass}>
      {content}
    </button>
  );
}
