"use client";

import { useEffect, useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Slider } from "@repo/ui/components/slider";

interface FormSliderProps {
  /** Current form value (undefined → falls back to `fallback`). */
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  step: number;
  /**
   * Called once when the user releases the thumb. Writing on every
   * `onValueChange` instead would re-render the canvas + Plotly chart on
   * every pointer move, producing a perceptible drag lag.
   */
  onCommit: (next: number) => void;
  /** How to render the live value next to the label (e.g., "8px", "60%"). */
  formatBadge: (v: number) => string;
  label: string;
}

/**
 * Slider bound to a react-hook-form field, with two key UX wrinkles:
 *
 * 1. The thumb tracks LOCAL state during drag so the slider stays
 *    responsive even when the parent (canvas + Plotly) is expensive to
 *    re-render.
 * 2. The form is only written via `onValueCommit` — once on release —
 *    so the autosave watch fires once per drag instead of per pointer
 *    move.
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
        onValueChange={(values) => setLocal(values[0])}
        onValueCommit={(values) => onCommit(values[0])}
      />
      <FormMessage />
    </FormItem>
  );
}
