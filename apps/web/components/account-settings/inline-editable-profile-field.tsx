"use client";

import { Check, Pencil, X } from "lucide-react";
import type { FocusEvent } from "react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";

interface InlineEditableProfileFieldProps {
  label: string;
  value?: string | null;
  emptyValue: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  isPending?: boolean;
  multiline?: boolean;
}

export function InlineEditableProfileField({
  label,
  value,
  emptyValue,
  placeholder,
  onSave,
  isPending = false,
  multiline = false,
}: InlineEditableProfileFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState("");
  const isEmpty = !value?.trim();
  const displayValue = isEmpty ? emptyValue : value;

  const startEditing = () => {
    setEditedValue(value ?? "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedValue("");
    setIsEditing(false);
  };

  const saveValue = async () => {
    if (editedValue === (value ?? "")) {
      setIsEditing(false);
      return;
    }

    await onSave(editedValue);
    setIsEditing(false);
  };

  const handleBlur = (event: FocusEvent) => {
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.dataset.role === "edit-action") return;
    cancelEditing();
  };

  if (isEditing) {
    const inputId = `${label.replace(/\W+/g, "-").toLowerCase()}-field`;

    return (
      <div
        className="border-primary/20 bg-card rounded-md border p-3 shadow-sm"
        onBlur={handleBlur}
      >
        <label htmlFor={inputId} className="text-muted-foreground text-xs font-medium uppercase">
          {label}
        </label>
        <div className="mt-2 space-y-2">
          {multiline ? (
            <Textarea
              id={inputId}
              value={editedValue}
              onChange={(event) => setEditedValue(event.target.value)}
              placeholder={placeholder}
              disabled={isPending}
              rows={4}
              autoFocus
            />
          ) : (
            <Input
              id={inputId}
              value={editedValue}
              onChange={(event) => setEditedValue(event.target.value)}
              placeholder={placeholder}
              disabled={isPending}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveValue();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={cancelEditing}
              disabled={isPending}
              data-role="edit-action"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={saveValue}
              disabled={isPending}
              data-role="edit-action"
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="hover:border-primary/10 hover:bg-muted group flex w-full items-start justify-between gap-4 rounded-md border border-transparent px-3 py-3 text-left transition-colors"
      onClick={startEditing}
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="text-muted-foreground block text-xs font-medium uppercase">{label}</span>
        <span
          className={
            isEmpty
              ? "text-muted-foreground block break-words text-sm italic"
              : "text-foreground block break-words text-sm"
          }
        >
          {displayValue}
        </span>
      </span>
      <Pencil className="text-muted-foreground mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
