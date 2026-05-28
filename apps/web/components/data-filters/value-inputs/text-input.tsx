"use client";

import type { DataFilterValue } from "@repo/api/schemas/experiment.schema";
import { Input } from "@repo/ui/components/input";

export interface TextInputProps {
  value: DataFilterValue;
  onChange: (value: DataFilterValue) => void;
  placeholder: string;
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <Input
      className="h-9"
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
