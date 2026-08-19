"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

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
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          {t("organizations.create.identityTitle")}
        </CardTitle>
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
  );
}
