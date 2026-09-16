"use client";

import { CalibrationLayoutContent } from "@/components/calibrations/calibration-layout-content";
import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { PageContainer } from "@/components/page-container";
import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface CalibrationDefinitionLayoutProps {
  children: React.ReactNode;
}

export default function CalibrationDefinitionLayout({
  children,
}: CalibrationDefinitionLayoutProps) {
  const { definitionId } = useParams<{ definitionId: string }>();
  const locale = useLocale();
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useCalibrationDefinition(definitionId);

  return (
    <PageContainer width="fluid">
      <EntityLayoutShell
        isLoading={isLoading}
        error={error}
        hasData={!!data}
        loadingMessage={t("common.loading")}
      >
        {data && (
          <>
            <PlatformHeaderDetail
              href={`/${locale}/platform/calibrations/${definitionId}`}
              label={data.name}
            />
            <AutosaveStatusProvider>
              <CalibrationLayoutContent definitionId={definitionId} definition={data}>
                {children}
              </CalibrationLayoutContent>
            </AutosaveStatusProvider>
          </>
        )}
      </EntityLayoutShell>
    </PageContainer>
  );
}
