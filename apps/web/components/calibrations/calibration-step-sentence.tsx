"use client";

import type {
  ProcedureRead,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import { ROLE_PATTERN } from "./procedure-edits";
import type { ReadSource, SetpointTarget } from "./rig-sources";
import type { SetpointValue } from "./setpoint-list";
import { formatSetpoints, parseSetpoints } from "./setpoint-list";
import { StepReadsClause } from "./step-reads-clause";

const OPERATOR_STIMULUS = "operator";

interface CalibrationStepSentenceProps {
  step: ProcedureStep;
  sources: ReadSource[];
  targets: SetpointTarget[];
  /** Series this phase produces, this step's included, so a rename cannot collide. */
  takenSeries: string[];
  canEdit: boolean;
  onChange: (step: ProcedureStep) => void;
}

/** One step, written as the instruction it is, with its values editable where they are read. */
export function CalibrationStepSentence({
  step,
  sources,
  targets,
  takenSeries,
  canEdit,
  onChange,
}: CalibrationStepSentenceProps) {
  const { t } = useTranslation("iot");

  function seriesToken(series: string, onCommit: (series: string) => void) {
    // takenSeries carries every step's series including this one's own, once each; a
    // rename that collides shows up as the name appearing twice, not as it "still" being there.
    const taken = takenSeries.filter((name) => name === series).length > 1;
    return (
      <InlineToken
        value={series}
        label={t("iot.calibration.procedure.series")}
        canEdit={canEdit}
        mono
        invalid={
          taken
            ? t("iot.calibration.procedure.seriesTaken")
            : ROLE_PATTERN.test(series)
              ? undefined
              : t("iot.calibration.procedure.nameInvalid")
        }
        onCommit={onCommit}
      />
    );
  }

  function settleToken(ms: number | undefined, onCommit: (ms: number | undefined) => void) {
    return (
      <InlineToken
        value={ms === undefined ? "" : String(ms)}
        label={t("iot.calibration.procedure.settleFor")}
        canEdit={canEdit}
        inputMode="decimal"
        placeholder={t("iot.calibration.procedure.noSettle")}
        onCommit={(text) => {
          const parsed = Number(text.trim());
          onCommit(text.trim() === "" ? undefined : Number.isFinite(parsed) ? parsed : ms);
        }}
      />
    );
  }

  function valuesToken(
    values: SetpointValue[],
    numbersOnly: boolean,
    onCommit: (v: SetpointValue[]) => void,
  ) {
    return (
      <InlineToken
        value={formatSetpoints(values)}
        label={t("iot.calibration.procedure.values")}
        canEdit={canEdit}
        mono
        onCommit={(text) => {
          const parsed = parseSetpoints(text, numbersOnly);
          if (parsed !== null) {
            onCommit(parsed);
          }
        }}
      />
    );
  }

  function renderOperator() {
    if (step.kind !== "operator") return null;
    const prompt = (
      <InlineToken
        value={step.prompt}
        label={t("iot.calibration.procedure.prompt")}
        canEdit={canEdit}
        invalid={
          step.prompt.trim() === "" ? t("iot.calibration.procedure.promptRequired") : undefined
        }
        onCommit={(next) => onChange({ ...step, prompt: next })}
      />
    );

    if (step.confirm === undefined) {
      return (
        <Trans
          t={t}
          i18nKey="iot.calibration.procedure.sentence.operator"
          components={{ prompt }}
        />
      );
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.operatorConfirm"
        components={{
          prompt,
          confirm: (
            <InlineToken
              value={step.confirm}
              label={t("iot.calibration.procedure.confirm")}
              canEdit={canEdit}
              mono
              onCommit={(next) =>
                onChange({ ...step, confirm: next.trim() === "" ? undefined : next })
              }
            />
          ),
        }}
      />
    );
  }

  function renderSettle() {
    if (step.kind !== "settle") return null;
    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.settle"
        components={{
          ms: (
            <InlineToken
              value={String(step.ms)}
              label={t("iot.calibration.procedure.waitFor")}
              canEdit={canEdit}
              inputMode="decimal"
              onCommit={(text) => {
                const parsed = Number(text.trim());
                if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 600_000) {
                  onChange({ ...step, ms: parsed });
                }
              }}
            />
          ),
        }}
      />
    );
  }

  function renderSet() {
    if (step.kind !== "set") return null;
    const target = targets.find((candidate) => candidate.role === step.instrument);
    const setpoint = target?.setpoints.find((candidate) => candidate.name === step.set);

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.set"
        components={{
          instrument: (
            <InlineChoice
              value={step.instrument}
              label={t("iot.calibration.procedure.driven")}
              options={targets.map((candidate) => ({ value: candidate.role }))}
              canEdit={canEdit}
              onCommit={(instrument) => {
                const next = targets.find((candidate) => candidate.role === instrument);
                onChange({ ...step, instrument, set: next?.setpoints.at(0)?.name ?? "" });
              }}
            />
          ),
          setpoint: (
            <InlineChoice
              value={step.set}
              label={t("iot.calibration.procedure.setpoint")}
              options={(target?.setpoints ?? []).map((candidate) => ({
                value: candidate.name,
                hint: `${String(candidate.min)}…${String(candidate.max)} ${candidate.unit}`,
              }))}
              canEdit={canEdit}
              onCommit={(set) => onChange({ ...step, set })}
            />
          ),
          value: (
            <InlineToken
              value={String(step.value)}
              label={t("iot.calibration.procedure.value")}
              canEdit={canEdit}
              mono
              inputMode="decimal"
              onCommit={(text) => {
                const parsed = Number(text.trim());
                if (Number.isFinite(parsed)) {
                  onChange({ ...step, value: parsed });
                }
              }}
            />
          ),
          unit: <span className="text-muted-foreground">{setpoint?.unit ?? ""}</span>,
        }}
      />
    );
  }

  function renderRead() {
    if (step.kind !== "read") return null;
    const reads = (
      <StepReadsClause
        reads={step.read}
        sources={sources}
        canEdit={canEdit}
        onChange={(read: ProcedureRead[]) => onChange({ ...step, read })}
      />
    );
    const series = seriesToken(step.series, (next) => onChange({ ...step, series: next }));

    if (step.prompt === undefined) {
      return (
        <Trans
          t={t}
          i18nKey="iot.calibration.procedure.sentence.read"
          components={{ reads, series }}
        />
      );
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.readPrompt"
        components={{
          reads,
          series,
          prompt: (
            <InlineToken
              value={step.prompt}
              label={t("iot.calibration.procedure.prompt")}
              canEdit={canEdit}
              onCommit={(prompt) =>
                onChange({ ...step, prompt: prompt.trim() === "" ? undefined : prompt })
              }
            />
          ),
        }}
      />
    );
  }

  function renderSweep() {
    if (step.kind !== "sweep") return null;
    const stimulus = step.stimulus;
    const byInstrument = "instrument" in stimulus;
    const target = byInstrument
      ? targets.find((candidate) => candidate.role === stimulus.instrument)
      : undefined;

    const shared = {
      reads: (
        <StepReadsClause
          reads={step.read}
          sources={sources}
          canEdit={canEdit}
          onChange={(read: ProcedureRead[]) => onChange({ ...step, read })}
        />
      ),
      series: seriesToken(step.series, (series) => onChange({ ...step, series })),
      settle: settleToken(step.settleMs, (settleMs) => onChange({ ...step, settleMs })),
    };

    if (!byInstrument) {
      return (
        <Trans
          t={t}
          i18nKey="iot.calibration.procedure.sentence.sweepOperator"
          components={{
            ...shared,
            values: valuesToken(stimulus.values, false, (values) =>
              onChange({ ...step, stimulus: { ...stimulus, values } }),
            ),
            prompt: (
              <InlineToken
                value={stimulus.operator}
                label={t("iot.calibration.procedure.operatorPrompt")}
                canEdit={canEdit}
                onCommit={(operator) => onChange({ ...step, stimulus: { ...stimulus, operator } })}
              />
            ),
          }}
        />
      );
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.sweepInstrument"
        components={{
          ...shared,
          values: valuesToken(stimulus.values, true, (values) =>
            onChange({
              ...step,
              stimulus: {
                ...stimulus,
                values: values.flatMap((point) => (typeof point === "number" ? [point] : [])),
              },
            }),
          ),
          instrument: (
            <InlineChoice
              value={stimulus.instrument}
              label={t("iot.calibration.procedure.driven")}
              options={[
                ...targets.map((candidate) => ({ value: candidate.role })),
                { value: OPERATOR_STIMULUS, label: t("iot.calibration.procedure.operatorSource") },
              ]}
              canEdit={canEdit}
              onCommit={(role) => {
                if (role === OPERATOR_STIMULUS) {
                  onChange({
                    ...step,
                    stimulus: {
                      operator: t("iot.calibration.procedure.operatorStimulusPrompt"),
                      values: stimulus.values,
                    },
                  });
                  return;
                }
                const next = targets.find((candidate) => candidate.role === role);
                onChange({
                  ...step,
                  stimulus: {
                    instrument: role,
                    set: next?.setpoints.at(0)?.name ?? "",
                    values: stimulus.values.flatMap((point) =>
                      typeof point === "number" ? [point] : [],
                    ),
                  },
                });
              }}
            />
          ),
          setpoint: (
            <InlineChoice
              value={stimulus.set}
              label={t("iot.calibration.procedure.setpoint")}
              options={(target?.setpoints ?? []).map((candidate) => ({
                value: candidate.name,
                hint: `${String(candidate.min)}…${String(candidate.max)} ${candidate.unit}`,
              }))}
              canEdit={canEdit}
              onCommit={(set) => onChange({ ...step, stimulus: { ...stimulus, set } })}
            />
          ),
        }}
      />
    );
  }

  switch (step.kind) {
    case "operator":
      return renderOperator();
    case "settle":
      return renderSettle();
    case "set":
      return renderSet();
    case "read":
      return renderRead();
    case "sweep":
      return renderSweep();
  }
}
