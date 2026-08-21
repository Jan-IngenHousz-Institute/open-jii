"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { BriefcaseBusiness } from "lucide-react";

import type { CreateUserProfileBody } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";

import { InlineEditableProfileField } from "./inline-editable-profile-field";

interface ProfileInformationCardProps {
  profile: CreateUserProfileBody;
  onSaveBio: (bio: string) => Promise<void>;
  isPending?: boolean;
}

export function ProfileInformationCard({
  profile,
  onSaveBio,
  isPending = false,
}: ProfileInformationCardProps) {
  const { t } = useTranslation("account");

  return (
    <SettingsCard
      icon={BriefcaseBusiness}
      title={t("settings.ProfileInformationCard.title")}
      description={t("settings.ProfileInformationCard.description")}
      contentClassName="space-y-3"
    >
      <InlineEditableProfileField
        label={t("settings.ProfileInformationCard.bio")}
        value={profile.bio ?? ""}
        emptyValue={t("settings.ProfileInformationCard.emptyBio")}
        placeholder={t("settings.ProfileInformationCard.bioPlaceholder")}
        onSave={onSaveBio}
        isPending={isPending}
        multiline
      />
    </SettingsCard>
  );
}
