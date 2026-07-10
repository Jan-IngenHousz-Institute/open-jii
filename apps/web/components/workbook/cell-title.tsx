"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

interface CellTitleProps {
  name: string;
  /** Owner + editable host. When false the title is plain, non-interactive text. */
  canRename?: boolean;
  /** Persist the new name. Rejects to keep the editor open (e.g. on a name clash). */
  onRename?: (next: string) => Promise<void>;
  isPending?: boolean;
  labels: { rename: string; save: string; cancel: string };
}

/**
 * Compact inline-editable title for a workbook cell header. Rendered inside the
 * CellWrapper's colored pill, so it inherits the accent color/size and only
 * owns the pencil affordance + edit state machine.
 */
export function CellTitle({
  name,
  canRename = false,
  onRename,
  isPending,
  labels,
}: CellTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!canRename || !onRename) return <>{name}</>;

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    try {
      await onRename(next);
      setEditing(false);
    } catch {
      // Keep the editor open so the user can adjust a rejected name.
    }
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          disabled={isPending}
          autoFocus
          aria-label={labels.rename}
          className="h-6 w-44 text-[13px] font-semibold"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          disabled={isPending}
          aria-label={labels.save}
          onClick={() => void commit()}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          disabled={isPending}
          aria-label={labels.cancel}
          onClick={() => setEditing(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <span className="group/title inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{name}</span>
      <button
        type="button"
        aria-label={labels.rename}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(name);
          setEditing(true);
        }}
        className="shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
