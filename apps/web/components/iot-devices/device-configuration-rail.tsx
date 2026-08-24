"use client";

import { DeviceConfigDelivery } from "@/components/iot-devices/device-config-delivery";
import { formatHm } from "@/util/date";
import { ChevronDown, RefreshCw } from "lucide-react";
import { env } from "~/env";

import type { DeviceOnboardingConfig, IotDevice } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { CopyButton } from "@repo/ui/components/copy-button";
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";

/** What the rail is showing right now. */
export type RailState = "preview" | "issued" | "updating" | "stale";

export interface RailPreviewExperiment {
  id: string;
  name: string;
  /** Selected this session but not yet bound, so it is marked as new. */
  isNew: boolean;
}

interface DeviceConfigurationRailProps {
  device: IotDevice;
  state: RailState;
  /** Null until something has been issued this session. */
  config: DeviceOnboardingConfig | null;
  issuedAt: Date | null;
  /** Names to preview before issuance: bound plus currently selected. */
  previewExperiments: RailPreviewExperiment[];
  includeWorkbook: boolean;
  answered: number;
  requiredCount: number;
  missingAnswers: string[];
  canReissue: boolean;
  onReissue: () => void;
  blockedNotice?: React.ReactNode;
}

/**
 * The manifest of what the device will receive, present from first paint.
 *
 * Its honesty rule: pre-issue the rail shows only what the client already has
 * (thing name, family, chosen experiment names) and marks everything the server
 * resolves as "resolved when issued". It never fabricates a topic, an endpoint
 * or a workbook version to look complete.
 */
export function DeviceConfigurationRail({
  device,
  state,
  config,
  issuedAt,
  previewExperiments,
  includeWorkbook,
  answered,
  requiredCount,
  missingAnswers,
  canReissue,
  onReissue,
  blockedNotice,
}: DeviceConfigurationRailProps) {
  const { t } = useTranslation("iot");
  const isIssued = config !== null;

  function renderStateChip() {
    if (state === "updating") {
      return <Badge variant="outline">{t("iot.onboarding.rail.updating")}</Badge>;
    }
    if (state === "stale") {
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-500">
          {t("iot.onboarding.rail.stale")}
        </Badge>
      );
    }
    if (state === "issued" && issuedAt !== null) {
      return (
        <Badge variant="secondary">
          {t("iot.onboarding.rail.issuedAt", { time: formatHm(issuedAt) })}
        </Badge>
      );
    }
    return <Badge variant="outline">{t("iot.onboarding.rail.preview")}</Badge>;
  }

  function renderEndpoint() {
    if (config === null) {
      return (
        <p className="text-muted-foreground text-xs italic">
          {t("iot.onboarding.rail.resolvedWhenIssued")}
        </p>
      );
    }
    return (
      <div className="flex items-start gap-1">
        <p className="text-muted-foreground min-w-0 flex-1 break-all font-mono text-xs">
          {config.endpoint}
        </p>
        <CopyButton
          value={config.endpoint}
          label={t("iot.onboarding.rail.copy")}
          copiedLabel={t("iot.onboarding.rail.copied")}
        />
      </div>
    );
  }

  function renderIssuedExperiment(experiment: DeviceOnboardingConfig["experiments"][number]) {
    const counts = experiment.procedures.reduce(
      (acc, procedure) => ({
        protocols: acc.protocols + (procedure.type === "protocol" ? 1 : 0),
        commands: acc.commands + (procedure.type === "command" ? 1 : 0),
        questions: acc.questions + (procedure.type === "question" ? 1 : 0),
      }),
      { protocols: 0, commands: 0, questions: 0 },
    );

    return (
      <div key={experiment.experimentId} className="space-y-1">
        <p className="truncate text-sm font-medium">{experiment.experimentName}</p>
        <div className="flex items-start gap-1">
          <p className="text-muted-foreground min-w-0 flex-1 break-all font-mono text-xs">
            {experiment.topicPrefix}
          </p>
          <CopyButton
            value={experiment.topicPrefix}
            label={t("iot.onboarding.rail.copy")}
            copiedLabel={t("iot.onboarding.rail.copied")}
          />
        </div>
        {includeWorkbook ? (
          <p className="text-muted-foreground text-xs">
            {t("iot.onboarding.rail.procedureCounts", counts)}
            {experiment.workbookVersion !== null && (
              <span className="bg-muted ml-1.5 rounded px-1.5 font-mono text-[11px]">
                {t("iot.onboarding.rail.workbookVersion", { version: experiment.workbookVersion })}
              </span>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t("iot.onboarding.rail.workbookExcluded")}
          </p>
        )}
      </div>
    );
  }

  function renderExperiments() {
    if (config !== null) {
      return config.experiments.map(renderIssuedExperiment);
    }
    if (previewExperiments.length === 0) {
      return (
        <p className="text-muted-foreground text-xs">{t("iot.onboarding.rail.noExperiments")}</p>
      );
    }
    return previewExperiments.map((experiment) => (
      <div key={experiment.id} className="space-y-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {experiment.name}
          {experiment.isNew && (
            <Badge variant="outline" className="shrink-0">
              {t("iot.onboarding.rail.new")}
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground text-xs">{t("iot.onboarding.rail.topicsWhenIssued")}</p>
      </div>
    ));
  }

  return (
    <Card className={cn("shadow-none", state === "updating" && "opacity-70")}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t("iot.onboarding.rail.title")}</CardTitle>
        {renderStateChip()}
      </CardHeader>

      <CardContent className="space-y-4">
        {blockedNotice}

        <div className="bg-muted/50 space-y-2 rounded-lg p-3">
          <div>
            <p className="text-xs font-medium">{t("iot.onboarding.rail.thingName")}</p>
            <div className="flex items-start gap-1">
              <p className="text-muted-foreground min-w-0 flex-1 break-all font-mono text-xs">
                {device.thingName}
              </p>
              <CopyButton
                value={device.thingName}
                label={t("iot.onboarding.rail.copy")}
                copiedLabel={t("iot.onboarding.rail.copied")}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium">{t("iot.onboarding.rail.endpoint")}</p>
            {renderEndpoint()}
          </div>
        </div>

        <div className="space-y-3">{renderExperiments()}</div>

        {isIssued && (
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.rail.topicRule")}</p>
        )}

        {requiredCount > 0 && (
          <div className="space-y-1 border-t pt-3">
            <div className="flex items-center gap-2">
              <Progress value={(answered / requiredCount) * 100} className="h-2 flex-1" />
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {t("iot.onboarding.rail.answeredCount", {
                  answered,
                  required: requiredCount,
                })}
              </span>
            </div>
            {missingAnswers.length > 0 && (
              <p className="text-destructive text-xs">
                {t("iot.onboarding.rail.missing", { fields: missingAnswers.join(", ") })}
              </p>
            )}
          </div>
        )}

        {isIssued && (
          <div className="border-t pt-3">
            <DeviceConfigDelivery
              device={device}
              config={config}
              disabled={missingAnswers.length > 0}
              disabledHint={
                missingAnswers.length > 0
                  ? t("iot.onboarding.answerRequiredHint", { count: missingAnswers.length })
                  : null
              }
            />
          </div>
        )}

        {isIssued && (
          <Collapsible>
            <CollapsibleTrigger className="text-muted-foreground flex items-center gap-1 text-xs underline underline-offset-4">
              {t("iot.onboarding.rail.viewJson")}
              <ChevronDown className="size-3" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Inspectable before download: the file is no longer a mystery payload. */}
              <pre className="bg-muted/30 mt-2 max-h-64 overflow-auto rounded border p-2 font-mono text-xs">
                {JSON.stringify(config, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="space-y-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onReissue} disabled={!canReissue}>
            <RefreshCw className="mr-1.5 size-4" />
            {t("iot.onboarding.reissue")}
          </Button>
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.rail.memoryOnly")}</p>
          <a
            href={`${env.NEXT_PUBLIC_DOCS_URL}/developers/device-integration`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground text-xs underline underline-offset-4"
          >
            {t("iot.onboarding.rail.integrationGuide")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
