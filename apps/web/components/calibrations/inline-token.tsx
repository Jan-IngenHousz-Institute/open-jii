"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

/**
 * One editable value inside a sentence.
 *
 * A procedure reads as instructions rather than as a form, so a value carries no caption:
 * the words around it say what it is. Reading and editing are the same place, which is what
 * keeps the page legible with forty values on it.
 */
interface InlineTokenProps {
  value: string;
  /** What this value is, for anyone who cannot see the sentence it sits in. */
  label: string;
  canEdit: boolean;
  onCommit: (value: string) => void;
  /** Identifiers the script or the device will see, set in mono so they read as code. */
  mono?: boolean;
  /** Shown in place of an empty value, and styled as absent rather than as content. */
  placeholder?: string;
  /** Why the value is refused, shown on hover so a red word is never left unexplained. */
  invalid?: string;
  /**
   * Why a draft would be refused, checked as it is typed. A refused draft never commits:
   * it stays red with its reason on screen, and leaving it puts the saved value back.
   */
  validate?: (draft: string) => string | undefined;
  inputMode?: "text" | "decimal";
  className?: string;
}

const TOKEN =
  "rounded-sm underline decoration-dotted decoration-from-font underline-offset-4 transition-colors";

export function InlineToken({
  value,
  label,
  canEdit,
  onCommit,
  mono = false,
  placeholder,
  invalid,
  validate,
  inputMode = "text",
  className,
}: InlineTokenProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const isEditing = draft !== null;

  useEffect(() => {
    if (isEditing) {
      input.current?.select();
    }
  }, [isEditing]);

  const draftError = draft === null ? undefined : validate?.(draft);

  function commit() {
    const isChanged = draft !== null && draft !== value;
    if (isChanged && draftError === undefined) {
      onCommit(draft);
    }
    setDraft(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter on a refused draft keeps the field open, so the reason stays in view.
    if (event.key === "Enter") {
      event.preventDefault();
      if (draftError === undefined) {
        commit();
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
    }
  }

  const shown = value === "" ? (placeholder ?? "") : value;
  const face = cn(mono && "font-mono", value === "" && "text-muted-foreground italic", className);
  const isInvalid = invalid !== undefined;

  function withReason(token: ReactElement) {
    if (invalid === undefined) {
      return token;
    }

    return (
      <Tooltip key="reason">
        <TooltipTrigger asChild>{token}</TooltipTrigger>
        <TooltipContent>{invalid}</TooltipContent>
      </Tooltip>
    );
  }

  if (!canEdit) {
    return withReason(<span className={cn(face, isInvalid && "text-destructive")}>{shown}</span>);
  }

  if (isEditing) {
    const isDraftRefused = draftError !== undefined;

    return (
      <Tooltip key="draft" open={isDraftRefused}>
        <TooltipTrigger asChild>
          <input
            ref={input}
            value={draft}
            // Sized to its content, so a sentence does not carry a row of equal boxes.
            size={Math.max(draft.length + 1, 3)}
            aria-label={label}
            aria-invalid={isInvalid || isDraftRefused}
            inputMode={inputMode}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={cn(
              TOKEN,
              face,
              "bg-muted/60 focus:ring-ring -mx-0.5 px-0.5 focus:outline-none focus:ring-1",
              isDraftRefused && "text-destructive focus:ring-destructive decoration-destructive",
            )}
          />
        </TooltipTrigger>
        <TooltipContent>{draftError}</TooltipContent>
      </Tooltip>
    );
  }

  return withReason(
    <button
      type="button"
      aria-label={label}
      aria-invalid={isInvalid}
      onClick={() => setDraft(value)}
      className={cn(
        TOKEN,
        face,
        "hover:bg-muted focus-visible:ring-ring -mx-0.5 px-0.5 text-left focus-visible:outline-none focus-visible:ring-1",
        isInvalid && "decoration-destructive text-destructive",
      )}
    >
      {shown}
    </button>,
  );
}
