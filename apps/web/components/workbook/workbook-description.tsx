"use client";

import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { parseApiError } from "@/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookDescriptionProps {
  workbookId: string;
  description: string;
  hasAccess?: boolean;
}

/** Shared workbook description used by both the workbook and experiment-design pages. */
export function WorkbookDescription({
  workbookId,
  description,
  hasAccess = false,
}: WorkbookDescriptionProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook, isPending: isUpdating } = useWorkbookUpdate(workbookId);

  const handleSave = async (newDescription: string) => {
    await updateWorkbook(
      { id: workbookId, description: newDescription },
      {
        onSuccess: () => {
          toast({ description: t("workbooks.workbookUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <InlineEditableDescription
      description={description}
      hasAccess={hasAccess}
      onSave={handleSave}
      isPending={isUpdating}
      title={t("workbooks.descriptionTitle")}
      saveLabel={t("common.save")}
      cancelLabel={t("common.cancel")}
      placeholder={t("workbooks.descriptionPlaceholder")}
    />
  );
}
