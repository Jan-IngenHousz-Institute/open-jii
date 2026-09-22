"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { NewOrganizationFormValues } from "../form-step";

interface ProfileSectionProps {
  formData: NewOrganizationFormValues;
  onEdit: () => void;
  className?: string;
}

export function ProfileSection({ formData, onEdit, className }: ProfileSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("organizations.create.profileTitle")}
      action={
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      }
      className={className}
      contentClassName="space-y-2"
    >
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.description")}
      </div>
      {/* Plain text, so it is rendered as typed rather than through the rich-text
            renderer the experiment review uses. */}
      <div className="whitespace-pre-line break-words text-sm">
        {formData.description.trim() || "—"}
      </div>

      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.website")}
      </div>
      <div className="break-all text-base font-medium">{formData.website.trim() || "—"}</div>

      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.location")}
      </div>
      <div className="break-words text-base font-medium">{formData.location.trim() || "—"}</div>

      {/* Read back here so the summary and the create body cannot disagree about it. */}
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.visibility.title")}
      </div>
      <div className="text-base font-medium">
        {formData.visibility === "public"
          ? t("organizations.visibility.publicLabel")
          : t("organizations.visibility.privateLabel")}
      </div>
    </SettingsCard>
  );
}
