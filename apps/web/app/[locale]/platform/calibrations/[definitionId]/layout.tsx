"use client";

import { CalibrationDuplicateAction } from "@/components/calibrations/calibration-duplicate-action";
import { CalibrationLayoutContent } from "@/components/calibrations/calibration-layout-content";
import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { PageContainer } from "@/components/page-container";
import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import { useLocale } from "@/hooks/useLocale";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

interface CalibrationDefinitionLayoutProps {
  children: React.ReactNode;
}

export default function CalibrationDefinitionLayout({
  children,
}: CalibrationDefinitionLayoutProps) {
  const { definitionId } = useParams<{ definitionId: string }>();
  const locale = useLocale();
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { t: tIot } = useTranslation("iot");
  const { data, isLoading, error } = useCalibrationDefinition(definitionId);
  const support = useIotBrowserSupport(data?.family);

  const detailPath = `/${locale}/platform/calibrations/${definitionId}`;
  const isBench = pathname === `${detailPath}/run`;

  // The platform never reaches hardware itself; without Web Serial there is no bench.
  const benchButton = (
    <Button size="sm" disabled={!support.serial} asChild={support.serial}>
      {support.serial ? (
        <Link href={`${detailPath}/run`}>
          <Play className="mr-2 h-4 w-4" />
          {tIot("iot.calibration.trial.action")}
        </Link>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          {tIot("iot.calibration.trial.action")}
        </>
      )}
    </Button>
  );

  // A definition a run has closed is read-only, so the next revision starts as a copy.
  const canDuplicate = data !== undefined && data.runCount > 0 && !isBench;

  const benchAction = support.serial ? (
    benchButton
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>{benchButton}</TooltipTrigger>
      <TooltipContent>{tIot("iot.calibration.connect.unsupportedBrowser")}</TooltipContent>
    </Tooltip>
  );

  const actions = isBench ? (
    <Button variant="outline" size="sm" asChild>
      <Link href={detailPath}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("common.back")}
      </Link>
    </Button>
  ) : (
    <>
      {canDuplicate && <CalibrationDuplicateAction definition={data} />}
      {benchAction}
    </>
  );

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
            <PlatformHeaderDetail href={detailPath} label={data.name} />
            <AutosaveStatusProvider>
              <CalibrationLayoutContent
                definitionId={definitionId}
                definition={data}
                actions={actions}
                showTabs={!isBench}
              >
                {children}
              </CalibrationLayoutContent>
            </AutosaveStatusProvider>
          </>
        )}
      </EntityLayoutShell>
    </PageContainer>
  );
}
