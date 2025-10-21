"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent, RichTextRenderer } from "@repo/ui/components";

interface DetailsSectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
}

export function DetailsSection({ formData, onEdit }: DetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{t("experiments.detailsTitle")}</CardTitle>
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground text-xs transition-colors"
          >
            {t("common.edit")}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
              {t("experiments.experimentName")}
            </div>
            <div className="text-base font-medium">{formData.name || "—"}</div>
          </div>

          {formData.description && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                {t("experiments.descriptionTitle")}
              </div>
              <div className="rounded-md border p-3 text-sm">
                <RichTextRenderer content={formData.description} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
