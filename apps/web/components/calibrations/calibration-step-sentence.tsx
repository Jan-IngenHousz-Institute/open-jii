"use client";

import type {
  ProcedureRead,
  ProcedureStep,
} from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

import { formatSpan } from "./format-range";
import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import { ROLE_PATTERN } from "./procedure-edits";
import type { ReadSource, SetpointOption, SetpointTarget } from "./rig-sources";
import type { SetpointValue } from "./setpoint-list";
import { formatSetpoints, numericSetpoints, parseSetpoints } from "./setpoint-list";
import { StepReadsClause } from "./step-reads-clause";

const OPERATOR_STIMULUS = "operator";

/** The longest wait a settle step may hold, as the procedure contract counts it. */
const MAX_WAIT_MS = 600_000;

type StepOf<K extends ProcedureStep["kind"]> = Extract<ProcedureStep, { kind: K }>;

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

  function setpointOptions(setpoints: SetpointOption[]) {
    return setpoints.map((setpoint) => ({ value: setpoint.name, hint: formatSpan(setpoint) }));
  }

  function roleOptions() {
    return targets.map((target) => ({ value: target.role }));
  }

  function seriesToken(series: string, onCommit: (series: string) => void) {
    // takenSeries carries every step's series including this one's own, once each; a
    // rename that collides shows up as the name appearing twice, not as it "still" being there.
    const isTaken = takenSeries.filter((name) => name === series).length > 1;
    const isWellFormed = ROLE_PATTERN.test(series);

    return (
      <InlineToken
        value={series}
        label={t("iot.calibration.procedure.series")}
        canEdit={canEdit}
        mono
        invalid={
          isTaken
            ? t("iot.calibration.procedure.seriesTaken")
            : isWellFormed
              ? undefined
              : t("iot.calibration.procedure.nameInvalid")
        }
        onCommit={onCommit}
      />
    );
  }

  function settleToken(ms: number | undefined, onCommit: (ms: number | undefined) => void) {
    // Cleared means no settle at all; anything that is not a number keeps what was there.
    function commitSettle(text: string) {
      const isCleared = text.trim() === "";
      const parsed = Number(text.trim());

      if (isCleared) {
        onCommit(undefined);
      } else if (Number.isFinite(parsed)) {
        onCommit(parsed);
      }
    }

    return (
      <InlineToken
        value={ms === undefined ? "" : String(ms)}
        label={t("iot.calibration.procedure.settleFor")}
        canEdit={canEdit}
        inputMode="decimal"
        placeholder={t("iot.calibration.procedure.noSettle")}
        onCommit={commitSettle}
      />
    );
  }

  function valuesToken(
    values: SetpointValue[],
    numbersOnly: boolean,
    onCommit: (v: SetpointValue[]) => void,
  ) {
    function commitValues(text: string) {
      const parsed = parseSetpoints(text, numbersOnly);
      if (parsed !== null) {
        onCommit(parsed);
      }
    }

    return (
      <InlineToken
        value={formatSetpoints(values)}
        label={t("iot.calibration.procedure.values")}
        canEdit={canEdit}
        mono
        onCommit={commitValues}
      />
    );
  }

  function readsClause(reads: ProcedureRead[], onCommit: (reads: ProcedureRead[]) => void) {
    return (
      <StepReadsClause reads={reads} sources={sources} canEdit={canEdit} onChange={onCommit} />
    );
  }

  function renderOperator(operator: StepOf<"operator">) {
    const prompt = (
      <InlineToken
        value={operator.prompt}
        label={t("iot.calibration.procedure.prompt")}
        canEdit={canEdit}
        invalid={
          operator.prompt.trim() === "" ? t("iot.calibration.procedure.promptRequired") : undefined
        }
        onCommit={(next) => onChange({ ...operator, prompt: next })}
      />
    );

    if (operator.confirm === undefined) {
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
              value={operator.confirm}
              label={t("iot.calibration.procedure.confirm")}
              canEdit={canEdit}
              mono
              onCommit={(next) =>
                onChange({ ...operator, confirm: next.trim() === "" ? undefined : next })
              }
            />
          ),
        }}
      />
    );
  }

  function renderSettle(settle: StepOf<"settle">) {
    function commitWait(text: string) {
      const parsed = Number(text.trim());
      const isInRange = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_WAIT_MS;

      if (isInRange) {
        onChange({ ...settle, ms: parsed });
      }
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.settle"
        components={{
          ms: (
            <InlineToken
              value={String(settle.ms)}
              label={t("iot.calibration.procedure.waitFor")}
              canEdit={canEdit}
              inputMode="decimal"
              onCommit={commitWait}
            />
          ),
        }}
      />
    );
  }

  function renderSet(set: StepOf<"set">) {
    const target = targets.find((candidate) => candidate.role === set.instrument);
    const setpoint = target?.setpoints.find((candidate) => candidate.name === set.set);

    // A new instrument's setpoints are not the old one's, so its first one is taken.
    function changeInstrument(instrument: string) {
      const next = targets.find((candidate) => candidate.role === instrument);
      onChange({ ...set, instrument, set: next?.setpoints.at(0)?.name ?? "" });
    }

    function commitValue(text: string) {
      const parsed = Number(text.trim());
      if (Number.isFinite(parsed)) {
        onChange({ ...set, value: parsed });
      }
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.set"
        components={{
          instrument: (
            <InlineChoice
              value={set.instrument}
              label={t("iot.calibration.procedure.driven")}
              options={roleOptions()}
              canEdit={canEdit}
              onCommit={changeInstrument}
            />
          ),
          setpoint: (
            <InlineChoice
              value={set.set}
              label={t("iot.calibration.procedure.setpoint")}
              options={setpointOptions(target?.setpoints ?? [])}
              canEdit={canEdit}
              onCommit={(name) => onChange({ ...set, set: name })}
            />
          ),
          value: (
            <InlineToken
              value={String(set.value)}
              label={t("iot.calibration.procedure.value")}
              canEdit={canEdit}
              mono
              inputMode="decimal"
              onCommit={commitValue}
            />
          ),
          unit: <span className="text-muted-foreground">{setpoint?.unit ?? ""}</span>,
        }}
      />
    );
  }

  function renderRead(read: StepOf<"read">) {
    const reads = readsClause(read.read, (next) => onChange({ ...read, read: next }));
    const series = seriesToken(read.series, (next) => onChange({ ...read, series: next }));

    if (read.prompt === undefined) {
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
              value={read.prompt}
              label={t("iot.calibration.procedure.prompt")}
              canEdit={canEdit}
              onCommit={(prompt) =>
                onChange({ ...read, prompt: prompt.trim() === "" ? undefined : prompt })
              }
            />
          ),
        }}
      />
    );
  }

  function renderSweep(sweep: StepOf<"sweep">) {
    const stimulus = sweep.stimulus;
    const shared = {
      reads: readsClause(sweep.read, (read) => onChange({ ...sweep, read })),
      series: seriesToken(sweep.series, (series) => onChange({ ...sweep, series })),
      settle: settleToken(sweep.settleMs, (settleMs) => onChange({ ...sweep, settleMs })),
    };

    if (!("instrument" in stimulus)) {
      return (
        <Trans
          t={t}
          i18nKey="iot.calibration.procedure.sentence.sweepOperator"
          components={{
            ...shared,
            values: valuesToken(stimulus.values, false, (values) =>
              onChange({ ...sweep, stimulus: { ...stimulus, values } }),
            ),
            prompt: (
              <InlineToken
                value={stimulus.operator}
                label={t("iot.calibration.procedure.operatorPrompt")}
                canEdit={canEdit}
                onCommit={(operator) => onChange({ ...sweep, stimulus: { ...stimulus, operator } })}
              />
            ),
          }}
        />
      );
    }

    const target = targets.find((candidate) => candidate.role === stimulus.instrument);

    // Handing the sweep to the operator keeps its points; handing it to an instrument keeps
    // only the ones it can be driven to, on that instrument's first setpoint.
    function changeSource(role: string) {
      if (role === OPERATOR_STIMULUS) {
        onChange({
          ...sweep,
          stimulus: {
            operator: t("iot.calibration.procedure.operatorStimulusPrompt"),
            values: stimulus.values,
          },
        });
        return;
      }

      const next = targets.find((candidate) => candidate.role === role);
      onChange({
        ...sweep,
        stimulus: {
          instrument: role,
          set: next?.setpoints.at(0)?.name ?? "",
          values: numericSetpoints(stimulus.values),
        },
      });
    }

    return (
      <Trans
        t={t}
        i18nKey="iot.calibration.procedure.sentence.sweepInstrument"
        components={{
          ...shared,
          values: valuesToken(stimulus.values, true, (values) =>
            onChange({ ...sweep, stimulus: { ...stimulus, values: numericSetpoints(values) } }),
          ),
          instrument: (
            <InlineChoice
              value={stimulus.instrument}
              label={t("iot.calibration.procedure.driven")}
              options={[
                ...roleOptions(),
                { value: OPERATOR_STIMULUS, label: t("iot.calibration.procedure.operatorSource") },
              ]}
              canEdit={canEdit}
              onCommit={changeSource}
            />
          ),
          setpoint: (
            <InlineChoice
              value={stimulus.set}
              label={t("iot.calibration.procedure.setpoint")}
              options={setpointOptions(target?.setpoints ?? [])}
              canEdit={canEdit}
              onCommit={(set) => onChange({ ...sweep, stimulus: { ...stimulus, set } })}
            />
          ),
        }}
      />
    );
  }

  switch (step.kind) {
    case "operator":
      return renderOperator(step);
    case "settle":
      return renderSettle(step);
    case "set":
      return renderSet(step);
    case "read":
      return renderRead(step);
    case "sweep":
      return renderSweep(step);
  }
}
