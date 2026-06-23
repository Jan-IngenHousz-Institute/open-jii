"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

interface ChartFrameProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  isLoading: boolean;
  error: unknown;
  hasRows: boolean;
  children: ReactNode;
}

/** Shared placeholder/state shell for chart renderers. */
export function ChartFrame({
  visualization,
  experimentId,
  isLoading,
  error,
  hasRows,
  children,
}: ChartFrameProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("errors.loadingData")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed p-8">
        <div className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="mb-2 font-medium">{t("errors.failedToLoadData")}</div>
          <div className="text-sm">
            <Trans
              i18nKey="errors.failedToLoadDataDescription"
              ns="experimentVisualizations"
              components={{
                configLink:
                  visualization.id && visualization.id !== "preview" ? (
                    <Link
                      href={`/platform/experiments/${experimentId}/analysis/visualizations/${visualization.id}`}
                      className="text-foreground underline hover:opacity-80"
                    />
                  ) : (
                    <span className="text-foreground" />
                  ),
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!hasRows) {
    return (
      <div className="bg-muted/20 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="text-muted-foreground mb-2 font-medium">{t("errors.noData")}</div>
          <div className="text-muted-foreground text-sm">{t("errors.noDataFound")}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ChartConfigError({ message }: { message: string }) {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed p-8">
      <div className="max-w-md text-center">
        <div className="mb-2 font-medium">{t("errors.configuration")}</div>
        <div className="text-sm">{message}</div>
      </div>
    </div>
  );
}
