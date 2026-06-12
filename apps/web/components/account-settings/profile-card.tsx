"use client";

import { BriefcaseBusiness } from "lucide-react";

import type { CreateUserProfileBody } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { InlineEditableProfileField } from "./inline-editable-profile-field";

interface ProfileCardProps {
  profile: CreateUserProfileBody;
  onSaveBio: (bio: string) => Promise<void>;
  onSaveOrganization: (organization: string) => Promise<void>;
  isPending?: boolean;
}

export function ProfileCard({
  profile,
  onSaveBio,
  onSaveOrganization,
  isPending = false,
}: ProfileCardProps) {
  const { t } = useTranslation("account");

  return (
    <Card className="rounded-md shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="text-primary h-5 w-5" aria-hidden />
          <CardTitle>{t("settings.profileCard.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.profileCard.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <InlineEditableProfileField
          label={t("settings.profileCard.bio")}
          value={profile.bio ?? ""}
          emptyValue={t("settings.profileCard.emptyBio")}
          placeholder={t("settings.profileCard.bioPlaceholder")}
          onSave={onSaveBio}
          isPending={isPending}
          multiline
        />

        <InlineEditableProfileField
          label={t("settings.profileCard.institution")}
          value={profile.organization ?? ""}
          emptyValue={t("settings.profileCard.emptyInstitution")}
          placeholder={t("settings.profileCard.institutionPlaceholder")}
          onSave={onSaveOrganization}
          isPending={isPending}
        />
      </CardContent>
    </Card>
  );
}
