"use client";

import type { ChangeEvent, FocusEvent } from "react";
import { useState } from "react";

import type { InputProps } from "@repo/ui/components/input";
import { Input } from "@repo/ui/components/input";

interface LayoutDecimalInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Decimals shown for a value set from outside, such as a click on the map. */
  fractionDigits: number;
}

function formatDecimal(value: number | null, fractionDigits: number): string {
  return value === null ? "" : value.toFixed(fractionDigits);
}

/**
 * A decimal typed as text and committed on blur, since a number input formats by the browser's
 * locale rather than the product's. A value set from outside replaces the draft.
 */
export function LayoutDecimalInput({
  value,
  onChange,
  onBlur,
  fractionDigits,
  ...props
}: LayoutDecimalInputProps) {
  const [draft, setDraft] = useState(formatDecimal(value, fractionDigits));
  const [committed, setCommitted] = useState(value);

  if (!Object.is(value, committed)) {
    setCommitted(value);
    setDraft(formatDecimal(value, fractionDigits));
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const text = draft.trim();
    const next = text === "" ? null : Number(text);
    setCommitted(next);
    onChange(next);
    onBlur?.(event);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
