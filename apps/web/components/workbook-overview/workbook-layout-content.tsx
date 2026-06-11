"use client";

import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { parseApiError } from "@/shared/api/apiError";
import { AutosaveIndicator } from "@/shared/ui/autosave/autosave-indicator";
import { useAutosaveStatus } from "@/shared/ui/autosave/autosave-status-context";
import { InlineEditableTitle } from "@/shared/ui/inline-editable-title";
import { formatDate } from "@/shared/utils/date";

import type { Workbook } from "@repo/api/schemas/workbook.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookLayoutContentProps {
  id: string;
  workbook: Workbook;
  children: React.ReactNode;
}

export function WorkbookLayoutContent({ id, workbook, children }: WorkbookLayoutContentProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { mutateAsync: updateWorkbook, isPending: isUpdating } = useWorkbookUpdate(id);
  const autosave = useAutosaveStatus();

  const isCreator = session?.user.id === workbook.createdBy;
  const indicatorStatus = isUpdating ? "saving" : (autosave?.status ?? "idle");

  const handleTitleSave = async (newName: string) => {
    await updateWorkbook(
      { params: { id }, body: { name: newName } },
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
    <div className="flex flex-1 flex-col">
      {/* Title + metadata constrained to max-w-7xl */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        {/* Title + save indicator */}
        <div className="flex flex-col gap-2">
          <InlineEditableTitle
            name={workbook.name}
            hasAccess={isCreator}
            onSave={handleTitleSave}
            isPending={isUpdating}
          />
          <AutosaveIndicator status={indicatorStatus} />
        </div>

        {/* Metadata row - stacked labels */}
        <div className="flex items-start gap-10 border-b border-[#EDF2F6] pb-8">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
              {tCommon("common.created")}
            </span>
            <span className="text-sm leading-[21px] text-[#68737B]">
              {formatDate(workbook.createdAt)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
              {tCommon("common.updated")}
            </span>
            <span className="text-sm leading-[21px] text-[#68737B]">
              {formatDate(workbook.updatedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
              {tCommon("common.createdBy")}
            </span>
            <span className="text-sm leading-[21px] text-[#68737B]">
              {workbook.createdByName ?? "-"}
            </span>
          </div>
        </div>
      </div>

      <div
        className="-mx-6 -mb-6 flex-1 border-t border-[#EDF2F6] px-6 pb-6"
        style={{ background: "linear-gradient(270.03deg, #F5FFF8 0%, #F4F9FF 100%)" }}
      >
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
