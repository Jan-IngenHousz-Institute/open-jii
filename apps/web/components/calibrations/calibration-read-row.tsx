"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { CalibrationNumberField } from "./calibration-number-field";
import { uniqueName } from "./output-schema-edits";
import { ROLE_PATTERN } from "./procedure-edits";
import { columnForRead, isDefaultColumn } from "./read-columns";
import type { ReadSource } from "./rig-sources";

/** Stands for the operator typing the value in, which no instrument can be asked for. */
const OPERATOR_SOURCE = "operator";

interface CalibrationReadRowProps {
  read: ProcedureRead;
  sources: ReadSource[];
  /** Every column this step records, this one included, so a rename cannot collide. */
  takenColumns: string[];
  canEdit: boolean;
  canRemove: boolean;
  onChange: (read: ProcedureRead) => void;
  onRemove: () => void;
}

/**
 * One reading taken at a point in the procedure, and the column it lands in.
 *
 * The column name is what the script indexes the DataFrame by, so it is as load bearing
 * as the command: a fit reads `points["par_raw"]` because a read step said so here.
 */
export function CalibrationReadRow({
  read,
  sources,
  takenColumns,
  canEdit,
  canRemove,
  onChange,
  onRemove,
}: CalibrationReadRowProps) {
  const { t } = useTranslation("iot");
  const sourceId = useId();
  const commandId = useId();
  const columnId = useId();

  const [draftColumn, setDraftColumn] = useState(read.as);
  const [committedColumn, setCommittedColumn] = useState(read.as);
  const [isSamplingOpen, setIsSamplingOpen] = useState(false);

  if (read.as !== committedColumn) {
    setCommittedColumn(read.as);
    setDraftColumn(read.as);
  }

  const isInstrumentRead = "instrument" in read;
  const source = isInstrumentRead
    ? sources.find((candidate) => candidate.role === read.instrument)
    : undefined;

  const isTaken = draftColumn !== read.as && takenColumns.includes(draftColumn);
  const isMalformed = !ROLE_PATTERN.test(draftColumn);
  const columnError = isTaken
    ? t("iot.calibration.procedure.columnTaken")
    : isMalformed
      ? t("iot.calibration.procedure.nameInvalid")
      : null;

  function handleColumnChange(value: string) {
    setDraftColumn(value);
    if (value !== read.as && ROLE_PATTERN.test(value) && !takenColumns.includes(value)) {
      onChange({ ...read, as: value });
    }
  }

  /**
   * A column the author named is theirs to keep; one the reading gave itself follows the
   * reading, so picking a different instrument does not leave `par_ref` on a lamp.
   */
  function columnFor(next: ProcedureRead): string {
    if (!isDefaultColumn(read, sources)) {
      return read.as;
    }
    const others = takenColumns.filter((column) => column !== read.as);
    return uniqueName(columnForRead(next, sources), others);
  }

  function handleSourceChange(value: string) {
    if (value === OPERATOR_SOURCE) {
      const next: ProcedureRead = {
        operator: t("iot.calibration.procedure.operatorReadPrompt"),
        as: read.as,
        type: "number",
      };
      onChange({ ...next, as: columnFor(next) });
      return;
    }

    const picked = sources.find((candidate) => candidate.role === value);
    const next: ProcedureRead = {
      instrument: value,
      command: picked?.offered[0] ?? "hello",
      as: read.as,
    };
    onChange({ ...next, as: columnFor(next) });
  }

  function handleCommandChange(command: string) {
    const next = { ...read, command };
    onChange({ ...next, as: columnFor(next) });
  }

  function renderSourceOption(candidate: ReadSource) {
    return (
      <SelectItem key={candidate.role} value={candidate.role} className="font-mono">
        {candidate.role}
      </SelectItem>
    );
  }

  function renderOfferedCommand(command: string) {
    return (
      <SelectItem key={command} value={command} className="font-mono">
        {command}
      </SelectItem>
    );
  }

  function renderCommandField() {
    if (!isInstrumentRead) {
      return (
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={commandId} className="text-xs">
            {t("iot.calibration.procedure.operatorPrompt")}
          </Label>
          <Input
            id={commandId}
            value={read.operator}
            onChange={(event) => onChange({ ...read, operator: event.target.value })}
            disabled={!canEdit}
            aria-invalid={read.operator.trim() === ""}
          />
        </div>
      );
    }

    // Bench equipment answers a fixed set of readings; a device answers whatever its
    // firmware knows, of which the driver's table is the documented part.
    if (source?.isExhaustive === true) {
      return (
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={commandId} className="text-xs">
            {t("iot.calibration.procedure.reading")}
          </Label>
          <Select
            value={read.command ?? ""}
            onValueChange={handleCommandChange}
            disabled={!canEdit}
          >
            <SelectTrigger id={commandId} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{source.offered.map(renderOfferedCommand)}</SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="min-w-40 flex-1 space-y-1">
        <Label htmlFor={commandId} className="text-xs">
          {t("iot.calibration.procedure.command")}
        </Label>
        <Input
          id={commandId}
          list={`${commandId}-offered`}
          value={read.command ?? ""}
          onChange={(event) => handleCommandChange(event.target.value)}
          disabled={!canEdit}
          aria-invalid={(read.command ?? "").trim() === ""}
          className="font-mono"
        />
        <datalist id={`${commandId}-offered`}>
          {(source?.offered ?? []).map((command) => (
            <option key={command} value={command} />
          ))}
        </datalist>
      </div>
    );
  }

  function renderTypeField() {
    if (isInstrumentRead) {
      return null;
    }

    return (
      <div className="min-w-28 space-y-1">
        <Label className="text-xs">{t("iot.calibration.procedure.typed")}</Label>
        <Select
          value={read.type}
          onValueChange={(type) => onChange({ ...read, type: type === "text" ? "text" : "number" })}
          disabled={!canEdit}
        >
          <SelectTrigger className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">{t("iot.calibration.procedure.typeNumber")}</SelectItem>
            <SelectItem value="text">{t("iot.calibration.procedure.typeText")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  function renderSampling() {
    if (!isInstrumentRead) {
      return null;
    }

    // Most readings are one sample taken at the driver's own pace, and the three knobs
    // for the rest would otherwise be the widest thing in the row.
    const hasSampling =
      read.repeat !== undefined || read.intervalMs !== undefined || read.timeoutMs !== undefined;

    if (!hasSampling && !isSamplingOpen) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsSamplingOpen(true)}
          disabled={!canEdit}
        >
          {t("iot.calibration.procedure.sampling")}
        </Button>
      );
    }

    return (
      <>
        <CalibrationNumberField
          label={t("iot.calibration.procedure.repeat")}
          value={read.repeat}
          onCommit={(repeat) => onChange({ ...read, repeat })}
          canEdit={canEdit}
          min={1}
          max={1000}
          integer
          clearable
          className="min-w-20 space-y-1"
        />
        <CalibrationNumberField
          label={t("iot.calibration.procedure.interval")}
          value={read.intervalMs}
          onCommit={(intervalMs) => onChange({ ...read, intervalMs })}
          canEdit={canEdit}
          min={0}
          max={600_000}
          integer
          clearable
          className="min-w-24 space-y-1"
        />
        <CalibrationNumberField
          label={t("iot.calibration.procedure.timeout")}
          value={read.timeoutMs}
          onCommit={(timeoutMs) => onChange({ ...read, timeoutMs })}
          canEdit={canEdit}
          min={1}
          max={600_000}
          integer
          clearable
          className="min-w-24 space-y-1"
        />
      </>
    );
  }

  return (
    <li className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-32 space-y-1">
          <Label htmlFor={sourceId} className="text-xs">
            {t("iot.calibration.procedure.source")}
          </Label>
          <Select
            value={isInstrumentRead ? read.instrument : OPERATOR_SOURCE}
            onValueChange={handleSourceChange}
            disabled={!canEdit}
          >
            <SelectTrigger id={sourceId} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map(renderSourceOption)}
              <SelectItem value={OPERATOR_SOURCE}>
                {t("iot.calibration.procedure.operatorSource")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {renderCommandField()}

        <div className="min-w-32 space-y-1">
          <Label htmlFor={columnId} className="text-xs">
            {t("iot.calibration.procedure.column")}
          </Label>
          <Input
            id={columnId}
            value={draftColumn}
            onChange={(event) => handleColumnChange(event.target.value)}
            onBlur={() => setDraftColumn(read.as)}
            disabled={!canEdit}
            aria-invalid={columnError !== null}
            className="font-mono"
          />
        </div>

        {renderTypeField()}
        {renderSampling()}

        {canEdit && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={!canRemove}
              aria-label={t("iot.calibration.procedure.removeRead", { column: read.as })}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {columnError !== null && <p className="text-destructive text-xs">{columnError}</p>}
    </li>
  );
}
