"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { Building2, Link2, Mail } from "lucide-react";

import type { CreateUserProfileBody } from "@repo/api/domains/user/user.schema";
import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";

import { UserAvatar } from "../user-avatar";
import { InlineEditableProfileField } from "./inline-editable-profile-field";

interface AccountIdentityCardProps {
  profile: CreateUserProfileBody;
  email?: string | null;
  onSaveName: (displayName: string) => Promise<void>;
  onSaveAvatarUrl: (avatarUrl: string) => Promise<void>;
  isPending?: boolean;
}

function getAvatarPreviewUrl(avatarUrl?: string | null) {
  if (!avatarUrl) {
    return null;
  }

  try {
    const parsed = new URL(avatarUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? avatarUrl : null;
  } catch {
    return null;
  }
}

export function AccountIdentityCard({
  profile,
  email,
  onSaveName,
  onSaveAvatarUrl,
  isPending = false,
}: AccountIdentityCardProps) {
  const { t } = useTranslation("account");
  // Read-only: the user's active organization (Better Auth). In phase 1 this is
  // their auto-provisioned personal workspace.
  const { data: activeOrg } = authClient.useActiveOrganization();
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    t("settings.profileCard.emptyName");
  const previewAvatarUrl = getAvatarPreviewUrl(profile.avatarUrl);

  return (
    <Card className="border-primary/10 bg-card overflow-hidden rounded-md shadow-sm">
      <div className="from-primary via-secondary to-accent h-1.5 bg-gradient-to-r" />
      <CardContent className="p-4 sm:p-6">
        <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
          <UserAvatar
            avatarUrl={previewAvatarUrl}
            firstName={profile.firstName}
            lastName={profile.lastName}
            className="border-card bg-surface ring-primary/15 h-24 w-24 shrink-0 border-4 text-2xl shadow-md ring-1"
          />

          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 sm:w-auto sm:items-start">
            <div className="flex w-full max-w-full sm:w-auto">
              <InlineEditableTitle
                name={displayName}
                hasAccess
                onSave={onSaveName}
                isPending={isPending}
                actionsInline
              />
            </div>

            <div className="flex max-w-full flex-wrap justify-center gap-2 sm:justify-start">
              {email && (
                <span className="bg-surface text-foreground/80 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{email}</span>
                </span>
              )}
              {activeOrg?.name && (
                <span className="bg-surface text-foreground/80 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                  <Building2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{activeOrg.name}</span>
                </span>
              )}
              <Badge
                className={profile.activated === false ? "bg-badge-archived" : "bg-badge-active"}
              >
                {profile.activated === false
                  ? t("settings.status.deactivated")
                  : t("settings.status.active")}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="text-muted-foreground mb-1.5 flex items-center gap-2 px-3 text-xs font-medium uppercase tracking-wide">
            <Link2 className="h-3.5 w-3.5" />
            {t("settings.AccountIdentityCard.title")}
          </div>
          <InlineEditableProfileField
            label={t("settings.AccountIdentityCard.urlLabel")}
            value={profile.avatarUrl ?? ""}
            emptyValue={t("settings.AccountIdentityCard.emptyUrl")}
            placeholder={t("settings.AccountIdentityCard.urlPlaceholder")}
            onSave={onSaveAvatarUrl}
            isPending={isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
