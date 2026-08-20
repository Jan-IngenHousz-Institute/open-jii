"use client";

import { downloadText, downloadZip } from "@/components/iot-devices/iot-credential-file";
import { AlertTriangle, Check, Download } from "lucide-react";

import type { IotDeviceGroupOnboardRow } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import type { DeviceAnswer, DeviceOnboardingConfig } from "@repo/api/domains/iot/iot.schema";
import { applyPlanAnswers } from "@repo/api/transforms/workbook-device-plan";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface GroupOnboardResultsProps {
  groupName: string;
  rows: IotDeviceGroupOnboardRow[];
  labelByDeviceId: Map<string, string>;
  /** Names of the experiments this batch bound; empty for a re-issue. */
  boundExperimentNames: string[];
  /** Plan answers, applied identically to every delivered config. */
  answers: Record<string, DeviceAnswer>;
  /** Required plan questions still unanswered block delivery, never onboarding. */
  deliveryBlocked: boolean;
}

function configFileName(config: DeviceOnboardingConfig): string {
  return `${config.thingName}-config.json`;
}

// Group names are free text; keep the archive name filesystem-safe.
function zipFileName(groupName: string): string {
  const safe = groupName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe === "" ? "group" : safe}-configs.zip`;
}

/**
 * Per-device outcomes plus delivery: each successful device's config as its
 * own file, and the whole batch as one zip with a manifest.
 */
export function GroupOnboardResults({
  groupName,
  rows,
  labelByDeviceId,
  boundExperimentNames,
  answers,
  deliveryBlocked,
}: GroupOnboardResultsProps) {
  const { t } = useTranslation("iot");

  const delivered = (config: DeviceOnboardingConfig) => applyPlanAnswers(config, answers);
  const succeeded = rows.flatMap((row) => (row.config === null ? [] : [row.config]));

  function downloadOne(config: DeviceOnboardingConfig) {
    downloadText(configFileName(config), JSON.stringify(delivered(config), null, 2));
  }

  function downloadAll() {
    const files = succeeded.map((config) => ({
      filename: configFileName(config),
      content: JSON.stringify(delivered(config), null, 2),
    }));
    files.push({
      filename: "manifest.json",
      content: JSON.stringify(
        {
          group: groupName,
          devices: succeeded.map((config) => config.thingName),
          experiments: [
            ...new Set(
              succeeded.flatMap((config) =>
                config.experiments.map((experiment) => experiment.experimentId),
              ),
            ),
          ],
        },
        null,
        2,
      ),
    });
    downloadZip(zipFileName(groupName), files);
  }

  function renderRow(row: IotDeviceGroupOnboardRow) {
    const label = labelByDeviceId.get(row.deviceId) ?? row.deviceId;
    const servedExperiments = (row.config?.experiments ?? []).map(
      (experiment) => experiment.experimentName,
    );

    return (
      <li key={row.deviceId} className="flex items-center gap-2 py-1.5 text-sm">
        {row.error === null ? (
          <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate">{label}</p>
          {row.config !== null && (
            <p className="text-muted-foreground truncate text-xs">
              {servedExperiments.length === 0
                ? t("iot.groups.onboarding.servesNothing")
                : t("iot.groups.onboarding.serves", {
                    experiments: servedExperiments.join(", "),
                  })}
            </p>
          )}
        </div>
        {row.error !== null && <span className="text-muted-foreground text-xs">{row.error}</span>}
        {row.config !== null && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("iot.groups.onboarding.downloadOne", { device: label })}
            disabled={deliveryBlocked}
            onClick={() => {
              if (row.config !== null) downloadOne(row.config);
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {boundExperimentNames.length === 0
          ? t("iot.groups.onboarding.reissuedNote")
          : t("iot.groups.onboarding.boundNote", {
              experiments: boundExperimentNames.join(", "),
            })}
      </p>

      <ul className="divide-y rounded-lg border px-3">{rows.map(renderRow)}</ul>

      {succeeded.length > 0 && (
        <Button disabled={deliveryBlocked} onClick={downloadAll}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t("iot.groups.onboarding.downloadAll", { count: succeeded.length })}
        </Button>
      )}
    </div>
  );
}
