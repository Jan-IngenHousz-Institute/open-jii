"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { ResourceDetailTabs } from "@/components/sharing/resource-detail-tabs";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { BookOpen } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import type { WorkbookDetail } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookLayoutContentProps {
  id: string;
  workbook: WorkbookDetail;
  children: React.ReactNode;
}

export function WorkbookLayoutContent({ id, workbook, children }: WorkbookLayoutContentProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook, isPending: isUpdating } = useWorkbookUpdate(id);
  const autosave = useAutosaveStatus();

  // Capability, not ownership: a "Can edit" grantee renames and edits.
  const { canUpdate, canShare, canLeave } = workbook.capabilities;
  const indicatorStatus = isUpdating ? "saving" : (autosave?.status ?? "idle");

  const handleTitleSave = async (newName: string) => {
    await updateWorkbook(
      { id, name: newName },
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
    // Only the title stays above the strip. The description, the provenance row
    // and the editor's canvas all belong to the Overview route, so switching to
    // Collaborators leaves the workbook's own chrome behind — the same as on an
    // experiment. (Fluid; the parent PageContainer controls overall width.)
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <InlineEditableTitle
          name={workbook.name}
          hasAccess={canUpdate}
          onSave={handleTitleSave}
          isPending={isUpdating}
          icon={<BookOpen className="h-6 w-6" />}
        />
        <AutosaveIndicator status={indicatorStatus} />
      </div>

      <ResourceDetailTabs
        resourceType="workbook"
        resourceId={id}
        canShare={canShare}
        canLeave={canLeave}
      >
        {children}
      </ResourceDetailTabs>
    </div>
  );
}
