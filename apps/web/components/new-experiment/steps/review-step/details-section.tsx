"use client";

import type { CreateExperimentBody } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { useWorkbook } from "../../../../hooks/workbook/useWorkbook/useWorkbook";

interface DetailsSectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
  className?: string;
}

export function DetailsSection({ formData, onEdit, className }: DetailsSectionProps) {
  const { t } = useTranslation();

  const { data: workbookData } = useWorkbook(formData.workbookId ?? "");

  const workbookName = formData.workbookId ? workbookData?.name : undefined;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">{t("experiments.detailsTitle")}</CardTitle>
        <Button type="button" onClick={onEdit} variant="link" size="sm">
          {t("common.edit")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {t("experiments.experimentName")}
        </div>
        <div className="text-base font-medium">{formData.name || "\u2014"}</div>

        {formData.description && (
          <>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
              {t("experiments.descriptionTitle")}
            </div>
            <div className="rounded-md border p-3 text-sm">
              <RichTextRenderer content={formData.description} />
            </div>
          </>
        )}

        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {t("newExperiment.workbook")}
        </div>
        <div className="text-base font-medium">
          {formData.workbookId ? (workbookName ?? "...") : "\u2014"}
        </div>
      </CardContent>
    </Card>
  );
}
