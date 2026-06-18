"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ResourceCollaborators } from "@/components/sharing/resource-collaborators";
import { WorkbookDraftEditor } from "@/components/workbook/workbook-draft-editor";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { use } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
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
  // persisted state as its first value.
  return (
    <div className="space-y-6">
      <WorkbookDraftEditor
        id={id}
        initialCells={data.cells as WorkbookCell[]}
        createdBy={data.createdBy}
        name={data.name}
      />
      <div className="rounded-lg border p-4">
        <ResourceCollaborators resourceType="workbook" resourceId={id} />
      </div>
    </div>
  );
}
