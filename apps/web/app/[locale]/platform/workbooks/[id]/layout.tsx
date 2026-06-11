"use client";

import { WorkbookLayoutContent } from "@/features/workbooks/components/workbook-overview/workbook-layout-content";
import { useWorkbook } from "@/features/workbooks/hooks/useWorkbook/useWorkbook";
import { AutosaveStatusProvider } from "@/shared/ui/autosave/autosave-status-context";
import { EntityLayoutShell } from "@/shared/ui/entity-layout-shell";
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
          <AutosaveStatusProvider>
            <WorkbookLayoutContent id={id} workbook={data}>
              {children}
            </WorkbookLayoutContent>
          </AutosaveStatusProvider>
        )}
      </EntityLayoutShell>
    </div>
  );
}
