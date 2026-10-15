"use client";

import { Hand, Microscope, Plus, X } from "lucide-react";
import { Fragment } from "react";

import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";

import { InlineChoice } from "./inline-choice";
import { InlineToken } from "./inline-token";
import { uniqueName } from "./output-schema-edits";
import { ROLE_PATTERN } from "./procedure-edits";
import { FALLBACK_COMMAND, columnForRead, isDefaultColumn } from "./read-columns";
import type { ReadSource } from "./rig-sources";

const OPERATOR_SOURCE = "operator";

type ReadKind = "instrument" | "operator";

const READ_KINDS: ReadKind[] = ["instrument", "operator"];

const READ_KIND_ICON: Record<ReadKind, typeof Hand> = {
  instrument: Microscope,
  operator: Hand,
};

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
    // An operator's reading carries a prompt of up to a sentence, longer than the line it
    // sits on, so that prompt may wrap; everything else in a reading stays together.
    const isHeldTogether = "instrument" in read;

    return (
      // Held on one line where there is room for it; a phone is narrower than one reading.
      // The separator sits outside, so a wrapped line never opens on a comma.
      <Fragment key={index}>
        {index > 0 && <span className="text-muted-foreground">, </span>}
        <span className={cn(isHeldTogether && "sm:whitespace-nowrap")}>
          {renderReading(read, index)}
          <span className="sm:whitespace-nowrap">
            {renderSource(read, index, columnError, canRemove)}
          </span>
        </span>
      </Fragment>
    );
  }

  /** The tail of a reading: where it comes from, the column it lands in, and its removal. */
  function renderSource(
    read: ProcedureRead,
    index: number,
    columnError: string | undefined,
    canRemove: boolean,
  ) {
    return (
      <>
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
            className="text-muted-foreground/60 hover:bg-muted focus-visible:ring-ring hover:text-destructive -my-1 inline-flex size-6 items-center justify-center rounded-sm align-middle focus-visible:outline-none focus-visible:ring-1"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </>
    );
  }

  function addInstrumentRead() {
    const source = sources.at(0);
    const read: ProcedureRead = {
      instrument: source?.role ?? "dut",
      command: source?.offered.at(0) ?? FALLBACK_COMMAND,
      as: "",
    };
    onChange([...reads, { ...read, as: uniqueName(columnForRead(read, sources), columns) }]);
  }

  // Placed ahead of the instrument reads, so the instruments are read when the operator
  // records the value, not the moment they confirm the setup.
  function addOperatorRead() {
    const read: ProcedureRead = {
      operator: t("iot.calibration.procedure.operatorReadPrompt"),
      as: "",
      type: "number",
    };
    const entry = { ...read, as: uniqueName(columnForRead(read, sources), columns) };
    const firstInstrument = reads.findIndex((current) => "instrument" in current);
    const at = firstInstrument === -1 ? reads.length : firstInstrument;
    onChange([...reads.slice(0, at), entry, ...reads.slice(at)]);
  }

  const addRead: Record<ReadKind, () => void> = {
    instrument: addInstrumentRead,
    operator: addOperatorRead,
  };

  function renderReadKind(kind: ReadKind) {
    const Icon = READ_KIND_ICON[kind];

    return (
      <DropdownMenuItem
        key={kind}
        onSelect={addRead[kind]}
        className="flex-col items-start gap-0.5"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-3.5" aria-hidden />
          {t(`iot.calibration.procedure.readKindName.${kind}`)}
        </span>
        <span className="text-muted-foreground pl-5.5 text-[11px]">
          {t(`iot.calibration.procedure.readKind.${kind}`)}
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <span className="[word-spacing:normal]">
      {reads.map(renderRead)}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("iot.calibration.procedure.addRead")}
              className="text-muted-foreground/60 hover:bg-muted focus-visible:ring-ring hover:text-foreground -my-1 ml-0.5 inline-flex size-6 items-center justify-center rounded-sm align-middle focus-visible:outline-none focus-visible:ring-1"
            >
              <Plus className="size-3" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {READ_KINDS.map(renderReadKind)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
