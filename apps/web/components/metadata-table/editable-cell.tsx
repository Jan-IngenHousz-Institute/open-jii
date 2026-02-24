"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";
import { useMetadata } from "./metadata-context";

interface EditableCellProps {
  value: unknown;
  rowId: string;
  columnId: string;
  type: "string" | "number" | "date";
  onUpdate: (rowId: string, columnId: string, value: unknown) => void;
  disabled?: boolean;
}

export function EditableCell({
  value,
  rowId,
  columnId,
  type,
  onUpdate,
  disabled = false,
}: EditableCellProps) {
  const { setIsEditingCell } = useMetadata();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync local editing state with context
  useEffect(() => {
    setIsEditingCell(isEditing);
  }, [isEditing, setIsEditingCell]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const newValue =
      type === "number" ? (editValue === "" ? null : Number(editValue)) : editValue;
    if (newValue !== value) {
      onUpdate(rowId, columnId, newValue);
    }
  }, [editValue, type, value, rowId, columnId, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleBlur();
      } else if (e.key === "Escape") {
        setEditValue(String(value ?? ""));
        setIsEditing(false);
      }
    },
    [handleBlur, value]
  );

  if (disabled) {
    return (
      <div className="px-2 py-1.5 text-sm">
        {String(value ?? "")}
      </div>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={type === "number" ? "number" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-8 rounded-none border-0 bg-transparent px-2 py-1 focus-visible:ring-1 focus-visible:ring-inset"
      />
    );
  }

  return (
    <div
      className={cn(
        "cursor-text px-2 py-1.5 text-sm",
        "hover:bg-muted/50 min-h-[32px]",
        type === "number" && "tabular-nums"
      )}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsEditing(true);
        }
      }}
      tabIndex={0}
      role="button"
    >
      {String(value ?? "") || <span className="text-muted-foreground">—</span>}
    </div>
  );
}
