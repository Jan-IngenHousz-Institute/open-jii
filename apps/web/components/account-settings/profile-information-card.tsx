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
    <Card className="rounded-md shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="text-primary h-5 w-5" aria-hidden />
          <CardTitle>{t("settings.ProfileInformationCard.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.ProfileInformationCard.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <InlineEditableProfileField
          label={t("settings.ProfileInformationCard.bio")}
          value={profile.bio ?? ""}
          emptyValue={t("settings.ProfileInformationCard.emptyBio")}
          placeholder={t("settings.ProfileInformationCard.bioPlaceholder")}
          onSave={onSaveBio}
          isPending={isPending}
          multiline
        />
      </CardContent>
    </Card>
  );
}
