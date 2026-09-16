"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { useAutosave } from "@/hooks/useAutosave";
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

import { CalibrationDetailsSidebar } from "./calibration-details-sidebar";
import { CalibrationOutputSchemaEditor } from "./calibration-output-schema-editor";
import { CalibrationProcedureSummary } from "./calibration-procedure-summary";
import { CalibrationRigEditor } from "./calibration-rig-editor";
import { CalibrationScriptEditor } from "./calibration-script-editor";

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

/**
 * Why the page is not saving, in the contract's own words, or null when it is.
 *
 * An author is briefly between two valid documents on almost every keystroke, so a draft
 * the contract would refuse is not an error to report at them. One that stays refused is:
 * without this, editing would go on over a document that silently never lands.
 */
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

/**
 * One bench procedure, read and written on the same page.
 *
 * Editing is in place rather than behind a form: an author works a piece at a time,
 * trying the procedure at the bench between changes. The whole document autosaves as one,
 * so a rename that reaches into the steps cannot be half-saved. A definition a run already
 * points at is frozen, because the run records which definition it ran rather than a copy.
 */
export function CalibrationDefinitionDetail() {
  const { t } = useTranslation("iot");
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const { data: definition, isLoading, isError } = useCalibrationDefinition(definitionId);
  const { mutateAsync: update } = useUpdateCalibrationDefinition(definitionId);

  const [draft, setDraft] = useState<DefinitionDraft>();
  const edited = definition === undefined ? undefined : (draft ?? toDraft(definition));
  const canEdit = definition?.capabilities.canUpdate ?? false;

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

  // A blocked draft has no save state worth reporting: "all changes saved" would be a
  // lie, and a spinner would promise a save that is not coming. The alert below says it.
  useReportAutosaveStatus({
    status: blocker === null ? autosave.status : null,
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
            <AlertDescription>{t("iot.calibration.detail.readOnly")}</AlertDescription>
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

        <PanelCard title={t("iot.calibration.detail.rig")}>
          <CalibrationRigEditor
            procedure={current.captureProcedure}
            family={definition.family}
            canEdit={canEdit}
            onChange={editProcedure}
          />
        </PanelCard>

        <PanelCard title={t("iot.calibration.detail.procedure")}>
          <CalibrationProcedureSummary procedure={current.captureProcedure} />
        </PanelCard>

        <PanelCard title={t("iot.calibration.detail.produces")}>
          <CalibrationOutputSchemaEditor
            family={definition.family}
            outputSchema={current.outputSchema}
            canEdit={canEdit}
            onChange={editOutputSchema}
          />
        </PanelCard>

        <PanelCard title={t("iot.calibration.detail.script")}>
          <CalibrationScriptEditor
            script={current.script}
            canEdit={canEdit}
            onChange={editScript}
          />
        </PanelCard>
      </div>
    </div>
  );
}
