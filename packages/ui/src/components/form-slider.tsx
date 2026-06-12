"use client";

import { useEffect, useState } from "react";

import { Badge } from "./badge";
import { FormItem, FormLabel, FormMessage } from "./form";
import { Slider } from "./slider";

interface FormSliderProps {
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  step: number;
  onCommit: (next: number) => void;
  formatBadge: (v: number) => string;
  label: string;
}

/**
 * Slider bound to a react-hook-form field. Tracks LOCAL state during drag
 * and only writes the form via `onValueCommit` (once on release), so the
 * autosave watch fires once per drag instead of per pointer move.
 */
export function FormSlider({
  value,
  fallback,
  min,
  max,
  step,
  onCommit,
  formatBadge,
  label,
}: FormSliderProps) {
  const initial = value ?? fallback;
  const [local, setLocal] = useState(initial);

  // Re-seed when the form value changes from outside the slider (e.g.
  // autosave bounce, programmatic reset, chart-type switch).
  useEffect(() => {
    setLocal(initial);
  }, [initial]);

  return (
    <FormItem>
      <div className="flex items-center justify-between">
        <FormLabel className="text-xs font-medium">{label}</FormLabel>
        <Badge variant="outline" className="font-mono text-[10px]">
          {formatBadge(local)}
        </Badge>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[local]}
        onValueChange={(values) => setLocal(values[0] ?? local)}
        onValueCommit={(values) => onCommit(values[0] ?? local)}
      />
      <FormMessage />
    </FormItem>
  );
}
