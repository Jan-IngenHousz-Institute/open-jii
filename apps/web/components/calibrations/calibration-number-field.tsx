"use client";

import { useId, useState } from "react";

import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

interface CalibrationNumberFieldProps {
  label: string;
  value: number | undefined;
  /** Called only with a number the constraints accept, or undefined when cleared. */
  onCommit: (value: number | undefined) => void;
  canEdit: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Whether emptying the field means "no value" rather than "still typing". */
  clearable?: boolean;
  /** Unit or hint shown under the field. */
  hint?: string;
  className?: string;
}

/** Typing passes through "", "-" and "1e", so the text stands alone until it parses. */
export function CalibrationNumberField({
  label,
  value,
  onCommit,
  canEdit,
  min,
  max,
  integer = false,
  clearable = false,
  hint,
  className,
}: CalibrationNumberFieldProps) {
  const fieldId = useId();
  const committed = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState<string>();
  const [lastCommitted, setLastCommitted] = useState(committed);

  // A value changed elsewhere (a type switch, a step moving) replaces what was typed.
  if (committed !== lastCommitted) {
    setLastCommitted(committed);
    setDraft(undefined);
  }

  function handleChange(text: string) {
    setDraft(text);

    if (text.trim() === "") {
      if (clearable) {
        onCommit(undefined);
      }
      return;
    }

    const parsed = Number(text);
    const isWhole = !integer || Number.isInteger(parsed);
    const isInRange = (min === undefined || parsed >= min) && (max === undefined || parsed <= max);

    if (Number.isFinite(parsed) && isWhole && isInRange) {
      onCommit(parsed);
    }
  }

  return (
    <div className={className ?? "min-w-24 flex-1 space-y-1"}>
      <Label htmlFor={fieldId} className="text-xs">
        {label}
      </Label>
      <Input
        id={fieldId}
        value={draft ?? committed}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setDraft(undefined)}
        disabled={!canEdit}
        inputMode="decimal"
        className="font-mono"
      />
      {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
