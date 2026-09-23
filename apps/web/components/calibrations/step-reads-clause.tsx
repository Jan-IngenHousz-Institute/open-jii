"use client";

import { Plus, X } from "lucide-react";

import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";

import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import { uniqueName } from "./output-schema-edits";
import { ROLE_PATTERN } from "./procedure-edits";
import { FALLBACK_COMMAND, columnForRead, isDefaultColumn } from "./read-columns";
import type { ReadSource } from "./rig-sources";

const OPERATOR_SOURCE = "operator";

interface StepReadsClauseProps {
  reads: ProcedureRead[];
  sources: ReadSource[];
  canEdit: boolean;
  onChange: (reads: ProcedureRead[]) => void;
}

/** What a step records, as a list that reads inside the step's own sentence. */
export function StepReadsClause({ reads, sources, canEdit, onChange }: StepReadsClauseProps) {
  const { t } = useTranslation("iot");

  const columns = reads.map((read) => read.as);

  function replace(index: number, read: ProcedureRead) {
    onChange(reads.map((current, at) => (at === index ? read : current)));
  }

  /** A column the reading named itself follows the reading; one the author chose stays put. */
  function columnFor(read: ProcedureRead, next: ProcedureRead): string {
    if (!isDefaultColumn(read, sources)) {
      return read.as;
    }
    return uniqueName(
      columnForRead(next, sources),
      columns.filter((column) => column !== read.as),
    );
  }

  function changeSource(index: number, read: ProcedureRead, role: string) {
    const next: ProcedureRead =
      role === OPERATOR_SOURCE
        ? {
            operator: t("iot.calibration.procedure.operatorReadPrompt"),
            as: read.as,
            type: "number",
          }
        : {
            instrument: role,
            command: sources.find((s) => s.role === role)?.offered[0] ?? FALLBACK_COMMAND,
            as: read.as,
          };
    replace(index, { ...next, as: columnFor(read, next) });
  }

  function removeRead(index: number) {
    onChange(reads.filter((_, at) => at !== index));
  }

  /** What is read: a closed list for bench equipment, typed for the device, asked of the operator. */
  function renderReading(read: ProcedureRead, index: number) {
    if (!("instrument" in read)) {
      return (
        <InlineToken
          value={read.operator}
          label={t("iot.calibration.procedure.operatorPrompt")}
          canEdit={canEdit}
          placeholder={t("iot.calibration.procedure.operatorReadPrompt")}
          onCommit={(operator) => replace(index, { ...read, operator })}
        />
      );
    }

    const source = sources.find((candidate) => candidate.role === read.instrument);

    function commitCommand(command: string) {
      replace(index, { ...read, as: columnFor(read, { ...read, command }), command });
    }

    if (source?.isExhaustive === true) {
      return (
        <InlineChoice
          value={read.command ?? ""}
          label={t("iot.calibration.procedure.reading")}
          options={source.offered.map((command) => ({ value: command }))}
          canEdit={canEdit}
          onCommit={commitCommand}
        />
      );
    }

    return (
      <InlineToken
        value={read.command ?? ""}
        label={t("iot.calibration.procedure.command")}
        canEdit={canEdit}
        mono
        placeholder={t("iot.calibration.procedure.commandPlaceholder")}
        onCommit={commitCommand}
      />
    );
  }

  function renderRead(read: ProcedureRead, index: number) {
    const isTaken = columns.filter((_, at) => at !== index).includes(read.as);
    const isWellFormed = ROLE_PATTERN.test(read.as);
    const columnError = isTaken
      ? t("iot.calibration.procedure.columnTaken")
      : isWellFormed
        ? undefined
        : t("iot.calibration.procedure.nameInvalid");
    const canRemove = canEdit && reads.length > 1;

    return (
      <span key={index} className="whitespace-nowrap">
        {index > 0 && <span className="text-muted-foreground">, </span>}

        {renderReading(read, index)}

        <span className="text-muted-foreground"> {t("iot.calibration.procedure.from")} </span>

        <InlineChoice
          value={"instrument" in read ? read.instrument : OPERATOR_SOURCE}
          label={t("iot.calibration.procedure.source")}
          options={[
            ...sources.map((candidate) => ({ value: candidate.role })),
            { value: OPERATOR_SOURCE, label: t("iot.calibration.procedure.operatorSource") },
          ]}
          canEdit={canEdit}
          onCommit={(role) => changeSource(index, read, role)}
        />

        <span className="text-muted-foreground"> {t("iot.calibration.procedure.as")} </span>

        <InlineToken
          value={read.as}
          label={t("iot.calibration.procedure.column")}
          canEdit={canEdit}
          mono
          invalid={columnError}
          onCommit={(as) => replace(index, { ...read, as })}
        />

        {canRemove && (
          <button
            type="button"
            aria-label={t("iot.calibration.procedure.removeRead", { column: read.as })}
            onClick={() => removeRead(index)}
            className="text-muted-foreground/60 hover:text-destructive ml-0.5 align-middle"
          >
            <X className="inline size-3" aria-hidden />
          </button>
        )}
      </span>
    );
  }

  function addRead() {
    const source = sources.at(0);
    const read: ProcedureRead = {
      instrument: source?.role ?? "dut",
      command: source?.offered.at(0) ?? FALLBACK_COMMAND,
      as: "",
    };
    onChange([...reads, { ...read, as: uniqueName(columnForRead(read, sources), columns) }]);
  }

  return (
    <span className="[word-spacing:normal]">
      {reads.map(renderRead)}
      {canEdit && (
        <button
          type="button"
          aria-label={t("iot.calibration.procedure.addRead")}
          onClick={addRead}
          className="text-muted-foreground/60 hover:text-foreground ml-1 align-middle"
        >
          <Plus className="inline size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
