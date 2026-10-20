"use client";

import type { ReactNode } from "react";

import { Label } from "@repo/ui/components/label";
import { RadioGroupItem } from "@repo/ui/components/radio-group";

interface ChoiceOptionProps {
  value: string;
  id: string;
  label: string;
  detail: string;
  /** Shown under the option while it is chosen, such as the field the choice opens. */
  children?: ReactNode;
}

/** One bordered radio row, as the calibration definition picker draws its choices. */
export function ChoiceOption({ value, id, label, detail, children }: ChoiceOptionProps) {
  return (
    <div className="hover:bg-muted/40 rounded-lg border px-4 py-3 transition-colors">
      <div className="flex items-start gap-3">
        <RadioGroupItem value={value} id={id} className="mt-0.5" />
        <Label
          htmlFor={id}
          className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal"
        >
          <span className="text-sm font-medium">{label}</span>
          <span className="text-muted-foreground text-xs leading-relaxed">{detail}</span>
        </Label>
      </div>
      {children}
    </div>
  );
}
