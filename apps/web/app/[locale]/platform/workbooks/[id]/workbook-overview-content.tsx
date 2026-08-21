"use client";

import { ErrorDisplay } from "@/components/error-display";
import { WorkbookMetaRow } from "@/components/workbook-overview/workbook-meta-row";
import { WorkbookDescription } from "@/components/workbook/workbook-description";
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
  // persisted state as its first value.
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-8">
        <WorkbookDescription
          workbookId={id}
          description={data.description ?? ""}
          hasAccess={data.capabilities.canUpdate}
        />

        <WorkbookMetaRow id={id} workbook={data} />
      </div>

      {/* The tinted canvas is the editor's, so it bleeds to the container edges
          here rather than in the layout — the Collaborators route renders on
          plain background, like the experiment collaborators page. */}
      <div
        className="border-border -mx-6 -mb-6 flex-1 border-t px-6 pb-6"
        style={{
          background: "linear-gradient(270.03deg, var(--accent) 0%, var(--secondary) 100%)",
        }}
      >
        <div className="flex w-full flex-1 flex-col gap-6">
          <WorkbookDraftEditor
            id={id}
            initialCells={data.cells}
            canEdit={data.capabilities.canUpdate}
            name={data.name}
          />
        </div>
      </div>
    </div>
  );
}
