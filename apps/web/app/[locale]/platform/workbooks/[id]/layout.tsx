"use client";

import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { WorkbookLayoutContent } from "@/components/workbook-overview/workbook-layout-content";
import { WorkbookSaveProvider } from "@/components/workbook-overview/workbook-save-context";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface WorkbookLayoutProps {
  children: React.ReactNode;
}

export default function WorkbookLayout({ children }: WorkbookLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useWorkbook(id);

  return (
    <div className="workbook-page flex flex-1 flex-col">
      <EntityLayoutShell
        isLoading={isLoading}
        error={error}
        hasData={!!data}
        loadingMessage={t("common.loading")}
      >
        {data && (
          <WorkbookSaveProvider>
            <WorkbookLayoutContent id={id} workbook={data}>
              {children}
            </WorkbookLayoutContent>
          </WorkbookSaveProvider>
        )}
      </EntityLayoutShell>
    </div>
  );
}
