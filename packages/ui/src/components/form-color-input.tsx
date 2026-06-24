"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";

interface FormColorInputProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: string | undefined;
  fallback: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  showHex?: boolean;
  placeholder?: string;
  swatchClassName?: string;
  hexClassName?: string;
  ariaLabel?: string;
  debounceMs?: number;
}

/**
 * Color swatch (+ optional hex field) bound to a react-hook-form field.
 * The native color picker emits an `input` event on every pointer move; a
 * chart that re-renders on each one can lock up the page. Tracks LOCAL
 * state for instant feedback and debounces the form write so the autosave
 * watch (and chart re-render) fires once the user settles on a color.
 *
 * Forwards its ref and spreads remaining props onto the root so it can be a
 * Radix `asChild` target (e.g. a TooltipTrigger).
 */
export const FormColorInput = React.forwardRef<HTMLDivElement, FormColorInputProps>(
  function FormColorInput(
    {
      value,
      fallback,
      onCommit,
      disabled = false,
      showHex = true,
      placeholder = "#000000",
      swatchClassName,
      hexClassName,
      ariaLabel,
      debounceMs = 150,
      className,
      ...rest
    },
    ref,
  ) {
    const [draft, setDraft] = useState(value ?? fallback);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Re-seed when the value changes from outside the picker (palette reset,
    // color-mapping toggle, chart-type switch).
    useEffect(() => {
      setDraft(value ?? fallback);
    }, [value, fallback]);

    useEffect(
      () => () => {
        if (timer.current) {
          clearTimeout(timer.current);
        }
      },
      [],
    );

    function handleChange(next: string) {
      setDraft(next);

      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => onCommit(next), debounceMs);
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)} {...rest}>
        <Input
          type="color"
          className={cn("h-9 w-12 shrink-0 p-1", swatchClassName)}
          value={draft || fallback}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel}
        />

        {showHex && (
          <Input
            type="text"
            className={cn("min-w-0 font-mono text-sm", hexClassName)}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            aria-label={ariaLabel}
          />
        )}
      </div>
    );
  },
);
