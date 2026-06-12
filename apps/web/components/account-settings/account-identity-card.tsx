"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { Building2, Link2, Mail } from "lucide-react";

import type { CreateUserProfileBody } from "@repo/api/schemas/user.schema";
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
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    t("settings.profileCard.emptyName");
  const previewAvatarUrl = getAvatarPreviewUrl(profile.avatarUrl);

  return (
    <Card className="border-primary/10 bg-card overflow-hidden rounded-md shadow-sm">
      <div className="from-primary via-secondary to-accent h-1.5 bg-gradient-to-r" />
      <CardContent className="p-6">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            avatarUrl={previewAvatarUrl}
            firstName={profile.firstName}
            lastName={profile.lastName}
            className="border-card bg-surface ring-primary/15 h-24 w-24 shrink-0 border-4 text-2xl shadow-md ring-1"
          />

          <div className="min-w-0 flex-1 space-y-3">
            <InlineEditableTitle
              name={displayName}
              hasAccess
              onSave={onSaveName}
              isPending={isPending}
              badges={
                <Badge
                  className={profile.activated === false ? "bg-badge-archived" : "bg-badge-active"}
                >
                  {profile.activated === false
                    ? t("settings.status.deactivated")
                    : t("settings.status.active")}
                </Badge>
              }
            />

            <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {email && (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{email}</span>
                </span>
              )}
              {profile.organization && (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{profile.organization}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-3">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 px-3 text-xs font-medium uppercase">
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
