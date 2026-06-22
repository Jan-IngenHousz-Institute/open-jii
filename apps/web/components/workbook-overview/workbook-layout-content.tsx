"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { parseApiError } from "~/util/apiError";

import type { Workbook } from "@repo/api/schemas/workbook.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
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
  const {
    data: versionsData,
    isLoading: isLoadingVersions,
    isError: isVersionsError,
  } = useWorkbookVersions(id);
  const autosave = useAutosaveStatus();

  // Versions are returned newest-first; the live page is the draft, so the
  // latest published version is the meaningful number to surface here.
  const latestVersion = versionsData?.body[0]?.version;
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
      {/* Title + metadata — fluid; the parent PageContainer controls overall width. */}
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-2">
          <InlineEditableTitle
            name={workbook.name}
            hasAccess={isCreator}
            onSave={handleTitleSave}
            isPending={isUpdating}
          />
          <AutosaveIndicator status={indicatorStatus} />
        </div>

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
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
              {t("workbooks.version")}
            </span>
            {isLoadingVersions ? (
              <Skeleton className="h-[21px] w-10" />
            ) : isVersionsError ? (
              // Don't claim "Draft" when the version state is simply unknown.
              <span className="text-sm leading-[21px] text-[#68737B]">-</span>
            ) : latestVersion != null ? (
              <WorkbookVersionBadge currentVersion={latestVersion} showUpgrade={false} />
            ) : (
              <span className="text-sm leading-[21px] text-[#68737B]">
                {t("workbooks.draftVersion")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="-mx-6 -mb-6 flex-1 border-t border-[#EDF2F6] px-6 pb-6"
        style={{ background: "linear-gradient(270.03deg, #F5FFF8 0%, #F4F9FF 100%)" }}
      >
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
