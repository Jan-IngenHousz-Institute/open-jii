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

  function commit() {
    if (draft !== null && draft !== value) {
      onCommit(draft);
    }
    setDraft(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
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
      <Tooltip>
        <TooltipTrigger asChild>{token}</TooltipTrigger>
        <TooltipContent>{invalid}</TooltipContent>
      </Tooltip>
    );
  }

  if (!canEdit) {
    return withReason(<span className={cn(face, isInvalid && "text-destructive")}>{shown}</span>);
  }

  if (isEditing) {
    return (
      <input
        ref={input}
        value={draft}
        // Sized to its content, so a sentence does not carry a row of equal boxes.
        size={Math.max(draft.length + 1, 3)}
        aria-label={label}
        aria-invalid={isInvalid}
        inputMode={inputMode}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          TOKEN,
          face,
          "bg-muted/60 focus:ring-ring -mx-0.5 px-0.5 focus:outline-none focus:ring-1",
        )}
      />
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
        "hover:bg-muted -mx-0.5 px-0.5 text-left",
        isInvalid && "decoration-destructive text-destructive",
      )}
    >
      {shown}
    </button>,
  );
}
