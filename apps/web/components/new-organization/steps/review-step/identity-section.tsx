"use client";

import { SettingsCard } from "@/components/shared/settings-card";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { organizationTypeLabelKey } from "../../../organizations/organization-labels";
import type { NewOrganizationFormValues } from "../form-step";
import { NO_TYPE } from "../form-step";

interface IdentitySectionProps {
  formData: NewOrganizationFormValues;
  onEdit: () => void;
  className?: string;
}

export function IdentitySection({ formData, onEdit, className }: IdentitySectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("organizations.create.identityTitle")}
      action={
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      }
      className={className}
      contentClassName="space-y-2"
    >
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.name")}
      </div>
      <div className="break-words text-base font-medium">{formData.name.trim() || "—"}</div>

      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.slug")}
      </div>
      {/* A slug has no spaces, so it is always one token and always the first to overflow. */}
      <div className="break-words text-base font-medium">{formData.slug || "—"}</div>

      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {t("organizations.fields.type")}
      </div>
      <div className="text-base font-medium">
        {formData.type === NO_TYPE
          ? t("organizations.types.unspecified")
          : t(organizationTypeLabelKey(formData.type))}
      </div>
    </SettingsCard>
  );
}
