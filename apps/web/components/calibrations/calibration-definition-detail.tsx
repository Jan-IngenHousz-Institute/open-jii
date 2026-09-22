"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { useAutosave } from "@/hooks/useAutosave";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type {
  CalibrationDefinitionDetail as CalibrationDefinition,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zUpdateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationBlocksSeam } from "./calibration-blocks-seam";
import { CalibrationDetailsSidebar } from "./calibration-details-sidebar";
import { CalibrationFitCell } from "./calibration-fit-cell";
import { CalibrationRigStrip } from "./calibration-rig-strip";
import { CalibrationSeriesSeam } from "./calibration-series-seam";
import { CalibrationStage } from "./calibration-stage";
import { CalibrationStepsEditor } from "./calibration-steps-editor";
import { describePhase, phaseSummary } from "./procedure-summary";
import { producedSeries } from "./produced-series";

/** The parts an author edits in place; the rest of the definition saves on its own. */
interface DefinitionDraft {
  captureProcedure: CaptureProcedure;
  outputSchema: CalibrationOutputSchema;
  script: string;
}

function toDraft(definition: CalibrationDefinition): DefinitionDraft {
  return {
    captureProcedure: definition.captureProcedure,
    outputSchema: definition.outputSchema,
    script: definition.script,
  };
}

/** A draft is briefly invalid on most keystrokes, so only a persistent refusal is shown. */
function saveBlocker(draft: DefinitionDraft | undefined): string | null {
  if (draft === undefined) {
    return null;
  }

  const parsed = zUpdateCalibrationDefinitionBody.safeParse(draft);
  if (parsed.success) {
    return null;
  }

  const [issue] = parsed.error.issues;
  const where = issue.path.join(".");

  return where === "" ? issue.message : `${where}: ${issue.message}`;
}

/** Autosaves as one document, so a rename reaching into the steps cannot half-save. */
export function CalibrationDefinitionDetail() {
  const { t } = useTranslation("iot");
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const { data: definition, isLoading, isError } = useCalibrationDefinition(definitionId);
  const { mutateAsync: update } = useUpdateCalibrationDefinition(definitionId);

  const [draft, setDraft] = useState<DefinitionDraft>();
  const edited = definition === undefined ? undefined : (draft ?? toDraft(definition));
  // A run records which definition it ran rather than a copy, so the server refuses the
  // edit. The page has to refuse it too, or every field invites a change that never lands.
  const isFrozen = (definition?.runCount ?? 0) > 0;
  const canEdit = (definition?.capabilities.canUpdate ?? false) && !isFrozen;

  const save = useCallback(
    async (value: DefinitionDraft | undefined) => {
      if (value === undefined) {
        return;
      }

      try {
        await update({ definitionId, ...value });
      } catch (error) {
        toast({ description: parseApiError(error)?.message, variant: "destructive" });
        throw error;
      }
    },
    [definitionId, update],
  );

  const blocker = saveBlocker(edited);

  const autosave = useAutosave<DefinitionDraft | undefined>({
    value: edited,
    toKey: (value) => JSON.stringify(value ?? null),
    isValid: (value) => value !== undefined && saveBlocker(value) === null,
    save,
    // Enabling anchors the saved copy to what the server sent, so the first edit is
    // the first thing saved.
    enabled: definition !== undefined && canEdit,
  });

  // A blocked or frozen draft has no save state worth reporting: "all changes saved" would
  // be a lie, and a spinner would promise a save that is not coming.
  const isReportable = canEdit && blocker === null;
  useReportAutosaveStatus({
    status: isReportable ? autosave.status : null,
    error: autosave.error,
  });

  const handleDescriptionSave = useCallback(
    async (description: string) => {
      try {
        await update({ definitionId, description });
      } catch (error) {
        toast({ description: parseApiError(error)?.message, variant: "destructive" });
      }
    },
    [definitionId, update],
  );

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (isError || definition === undefined || edited === undefined) {
    return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
  }

  const current = edited;
  const captured = producedSeries(current.captureProcedure, "steps");
  const capture = phaseSummary(current.captureProcedure, "steps");
  const verify = phaseSummary(current.captureProcedure, "verify");

  function editProcedure(captureProcedure: CaptureProcedure) {
    setDraft({ ...current, captureProcedure });
  }

  function editScript(script: string) {
    setDraft({ ...current, script });
  }

  function editOutputSchema(outputSchema: CalibrationOutputSchema) {
    setDraft({ ...current, outputSchema });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <CalibrationDetailsSidebar definitionId={definitionId} definition={definition} />

      <div className="min-w-0 flex-1 space-y-6 lg:order-1">
        <InlineEditableDescription
          description={definition.description ?? ""}
          hasAccess={canEdit}
          onSave={handleDescriptionSave}
          placeholder={t("iot.calibration.detail.describePlaceholder")}
        />

        {!canEdit && (
          <Alert>
            <Lock className="size-4" aria-hidden />
            <AlertDescription>
              {isFrozen
                ? t("iot.calibration.detail.frozen", { count: definition.runCount })
                : t("iot.calibration.detail.readOnly")}
            </AlertDescription>
          </Alert>
        )}

        {blocker !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.detail.notSaving")}
              <span className="mt-1 block font-mono text-xs">{blocker}</span>
            </AlertDescription>
          </Alert>
        )}

        <CalibrationStage index={1} title={t("iot.calibration.detail.rig")}>
          <CalibrationRigStrip
            procedure={current.captureProcedure}
            family={definition.family}
            canEdit={canEdit}
            onChange={editProcedure}
          />
        </CalibrationStage>

        <CalibrationStage
          index={2}
          title={t("iot.calibration.detail.steps")}
          summary={describePhase(capture, t)}
        >
          <CalibrationStepsEditor
            procedure={current.captureProcedure}
            phase="steps"
            family={definition.family}
            canEdit={canEdit}
            onChange={editProcedure}
          />
        </CalibrationStage>

        <CalibrationSeriesSeam series={captured} />

        <CalibrationStage index={3} title={t("iot.calibration.detail.script")}>
          <CalibrationFitCell
            script={current.script}
            outputSchema={current.outputSchema}
            series={captured}
            family={definition.family}
            canEdit={canEdit}
            onScriptChange={editScript}
            onSchemaChange={editOutputSchema}
          />
        </CalibrationStage>

        <CalibrationBlocksSeam outputSchema={current.outputSchema} family={definition.family} />

        <CalibrationStage
          index={4}
          title={t("iot.calibration.detail.verify")}
          note={t("iot.calibration.detail.verifyOptional")}
          summary={verify.steps === 0 ? undefined : describePhase(verify, t)}
        >
          <CalibrationStepsEditor
            procedure={current.captureProcedure}
            phase="verify"
            family={definition.family}
            canEdit={canEdit}
            onChange={editProcedure}
          />
        </CalibrationStage>
      </div>
    </div>
  );
}
