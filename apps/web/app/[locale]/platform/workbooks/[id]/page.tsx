"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ResourceOverviewTabs } from "@/components/sharing/resource-overview-tabs";
import { WorkbookDangerZone } from "@/components/workbook-overview/workbook-danger-zone";
import { WorkbookDraftEditor } from "@/components/workbook/workbook-draft-editor";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface WorkbookOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkbookOverviewPage({ params }: WorkbookOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useWorkbook(id);
  const { t } = useTranslation(["workbook", "common"]);

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error) {
    return <ErrorDisplay error={error} title={t("workbooks.errorLoading")} />;
  }
  if (!data) {
    return <div>{t("workbooks.notFound")}</div>;
  }

  // Mount the editor only after data loads so `useAutosave` sees the
  // persisted state as its first value. The Fork action lives in the workbook
  // layout header, next to the version/created-by metadata.
  return (
    <ResourceOverviewTabs
      resourceType="workbook"
      resourceId={id}
      canShare={data.capabilities.canShare}
      canLeave={data.capabilities.canLeave}
      className="flex flex-1 flex-col"
      overviewClassName="flex flex-1 flex-col gap-6"
    >
      <WorkbookDraftEditor
        id={id}
        initialCells={data.cells}
        canEdit={data.capabilities.canUpdate}
        name={data.name}
      />

      {/* Renders nothing unless the viewer may manage this workbook. Deletion
          lives here rather than on list rows: capabilities are detail-only, so a
          row could not tell a manager from a plain reader. */}
      <WorkbookDangerZone
        workbookId={id}
        workbookName={data.name}
        usedBy={data.experimentCount ?? 0}
        canManage={data.capabilities.canManage}
      />
    </ResourceOverviewTabs>
  );
}
