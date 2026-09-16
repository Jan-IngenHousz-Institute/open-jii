"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { useParams } from "next/navigation";
import { parseApiError } from "~/util/apiError";

import type { UpdateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationOutputBlocks } from "./calibration-output-blocks";
import { CalibrationProcedureSummary } from "./calibration-procedure-summary";
import { CalibrationScriptEditor } from "./calibration-script-editor";

/**
 * One bench procedure, read and written on the same page.
 *
 * Editing is in place rather than behind a form: an author works a piece at a time,
 * trying the procedure at the bench between changes. A definition a run already points at
 * is frozen, because the run records which definition it ran rather than a copy of it.
 */
export function CalibrationDefinitionDetail() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ definitionId: string }>();

  const { data: definition, isLoading, isError } = useCalibrationDefinition(params.definitionId);
  const { mutateAsync: update } = useUpdateCalibrationDefinition(params.definitionId);

  async function save(changes: UpdateCalibrationDefinitionBody) {
    try {
      await update({ definitionId: params.definitionId, ...changes });
    } catch (error) {
      toast({ description: parseApiError(error)?.message, variant: "destructive" });
      throw error;
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (isError || definition === undefined) {
    return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
  }

  const instruments = definition.captureProcedure.instruments;
  const canEdit = definition.capabilities.canUpdate;

  function renderFact([label, value]: [string, string]) {
    return (
      <div key={label} className="contents">
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }

  function renderInstrument(instrument: (typeof instruments)[number]) {
    return (
      <div key={instrument.role} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono">{instrument.role}</span>
        <span className="text-muted-foreground text-xs">
          {"handshake" in instrument
            ? t("iot.calibration.detail.answers", { handshake: instrument.handshake })
            : t("iot.calibration.detail.theDevice")}
        </span>
      </div>
    );
  }

  const facts: [string, string][] = [
    [t("iot.calibration.detail.created"), new Date(definition.createdAt).toLocaleString(locale)],
  ];
  if (definition.minFirmwareVersion !== null) {
    facts.push([t("iot.calibration.detail.firmwareFloor"), definition.minFirmwareVersion]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <InlineEditableDescription
          description={definition.description ?? ""}
          hasAccess={canEdit}
          onSave={(description) => save({ description })}
          placeholder={t("iot.calibration.detail.describePlaceholder")}
        />
      </div>

      {!canEdit && (
        <Alert>
          <AlertDescription>{t("iot.calibration.detail.readOnly")}</AlertDescription>
        </Alert>
      )}

      <PanelCard title={t("iot.calibration.detail.rig")}>
        <div className="space-y-3">
          <div className="space-y-1">{instruments.map(renderInstrument)}</div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {facts.map(renderFact)}
          </dl>
        </div>
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.procedure")}>
        <CalibrationProcedureSummary procedure={definition.captureProcedure} />
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.produces")}>
        <CalibrationOutputBlocks
          family={definition.family}
          outputSchema={definition.outputSchema}
        />
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.script")}>
        <CalibrationScriptEditor
          script={definition.script}
          canEdit={canEdit}
          onSave={(script) => save({ script })}
        />
      </PanelCard>
    </div>
  );
}
