"use client";

import type { ChangeEvent } from "react";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { Input } from "@repo/ui/components/input";

export interface NumericInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}

export function NumericInput({ value, onChange }: NumericInputProps) {
  const display = Array.isArray(value) ? value.join(", ") : String(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    // Pass mid-typing strings ("-", "1.") through so input doesn't snap back.
    const n = Number(raw);
    onChange(Number.isFinite(n) ? n : raw);
  };

  return <Input type="number" className="h-9" value={display} onChange={handleChange} />;
}
