"use client";

import { PageContainer } from "@/components/page-container";
import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { WorkbookLayoutContent } from "@/components/workbook-overview/workbook-layout-content";
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
    <PageContainer width="fluid">
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
    </PageContainer>
  );
}
