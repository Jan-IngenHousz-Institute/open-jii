"use client";

import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { Input } from "@repo/ui/components/input";

import { scalarFilterDisplay } from "../scalar-filter-display";

export interface TextInputProps {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
  placeholder: string;
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  const display = scalarFilterDisplay(value);
  return (
    <Input
      className="h-9"
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
