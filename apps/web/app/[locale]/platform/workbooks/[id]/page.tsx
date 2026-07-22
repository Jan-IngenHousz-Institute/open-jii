"use client";

import { ErrorDisplay } from "@/components/error-display";
import { WorkbookDraftEditor } from "@/components/workbook/workbook-draft-editor";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { GitFork, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface WorkbookOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkbookOverviewPage({ params }: WorkbookOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useWorkbook(id);
  const { t } = useTranslation(["workbook", "common"]);
  const locale = useLocale();
  const router = useRouter();

  const { mutate: createWorkbook, isPending: isForking } = useWorkbookCreate({
    onSuccess: (created) => router.push(`/${locale}/platform/workbooks/${created.id}`),
  });

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error) {
    return <ErrorDisplay error={error} title={t("workbooks.errorLoading")} />;
  }
  if (!data) {
    return <div>{t("workbooks.notFound")}</div>;
  }

  const handleFork = () => {
    createWorkbook({
      name: t("workbooks.duplicateName", { name: data.name }),
      description: data.description ?? undefined,
      cells: data.cells,
      metadata: data.metadata,
      forkedFrom: data.id,
    });
  };

  // Mount the editor only after data loads so `useAutosave` sees the
  // persisted state as its first value.
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleFork} disabled={isForking}>
          {isForking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitFork className="mr-2 h-4 w-4" />
          )}
          {t("workbooks.actions.fork")}
        </Button>
      </div>
      <WorkbookDraftEditor
        id={id}
        initialCells={data.cells}
        createdBy={data.createdBy}
        name={data.name}
      />
    </div>
  );
}
