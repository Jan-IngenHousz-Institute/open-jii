"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableDescription } from "@/components/shared/inline-editable-description";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { useAutosave } from "@/hooks/useAutosave";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { z } from "zod";
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

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** What keeps a draft from saving. A draft is briefly invalid on most keystrokes, so only a persistent refusal is shown. */
function saveIssues(draft: DefinitionDraft | undefined): z.ZodIssue[] {
  if (draft === undefined) {
    return [];
  }

  const parsed = zUpdateCalibrationDefinitionBody.safeParse(draft);
  return parsed.success ? [] : parsed.error.issues;
}

/** Where a problem sits, named the way the page names it rather than as a schema path. */
function locateIssue(path: (string | number)[], draft: DefinitionDraft, t: Translate): string {
  const [section, part, index, ...rest] = path;
  const position = typeof index === "number" ? index + 1 : undefined;

  if (section === "captureProcedure" && part === "instruments" && typeof index === "number") {
    const role = draft.captureProcedure.instruments.at(index)?.role;
    return role === undefined || role === ""
      ? t("iot.calibration.detail.rig")
      : `${t("iot.calibration.detail.rig")}, ${role}`;
  }
  if (section === "captureProcedure" && (part === "steps" || part === "verify")) {
    const stage = t(
      part === "steps" ? "iot.calibration.detail.steps" : "iot.calibration.detail.verify",
    );
    return position === undefined
      ? stage
      : `${stage}, ${t("iot.calibration.detail.problemStep", { position })}`;
  }
  if (section === "outputSchema") {
    const name = [index, ...rest].filter((segment) => typeof segment === "string").join(".");
    return name === ""
      ? t("iot.calibration.fit.submits")
      : `${t("iot.calibration.fit.submits")}, ${name}`;
  }
  if (section === "script") {
    return t("iot.calibration.detail.script");
  }

  return t("iot.calibration.detail.steps");
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

  const issues = saveIssues(edited);
  const isBlocked = issues.length > 0;

  const autosave = useAutosave<DefinitionDraft | undefined>({
    value: edited,
    toKey: (value) => JSON.stringify(value ?? null),
    isValid: (value) => value !== undefined && saveIssues(value).length === 0,
    save,
    // Enabling anchors the saved copy to what the server sent, so the first edit is
    // the first thing saved.
    enabled: definition !== undefined && canEdit,
  });

  // A blocked or frozen draft has no save state worth reporting: "all changes saved" would
  // be a lie, and a spinner would promise a save that is not coming.
  const isReportable = canEdit && !isBlocked;
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

  // One line per distinct problem: the same refusal from two refinements reads once.
  const problems = [
    ...new Set(issues.map((issue) => `${locateIssue(issue.path, current, t)}: ${issue.message}`)),
  ];

  function renderProblem(problem: string) {
    return <li key={problem}>{problem}</li>;
  }

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

        {isBlocked && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.detail.notSaving", { count: problems.length })}
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {problems.map(renderProblem)}
              </ul>
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

          {/* What these steps hand the fit, at the foot of the stage that produces it. */}
          <CalibrationSeriesSeam series={captured} />
        </CalibrationStage>

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
