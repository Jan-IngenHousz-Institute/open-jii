"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";

interface EditableWorkbookTitleProps {
  name: string;
  onRename: (next: string) => void;
  readOnly?: boolean;
}

/**
 * Inline-editable workbook title. Click to edit; Enter / blur commits, Escape
 * cancels. Renders a plain heading when read-only.
 */
export function EditableWorkbookTitle({ name, onRename, readOnly }: EditableWorkbookTitleProps) {
  const { t } = useTranslation("workbook");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) {
      onRename(next);
    } else {
      setDraft(name);
    }
  };

  if (readOnly) {
    return <h1 className="truncate text-2xl font-bold text-gray-900">{name}</h1>;
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label={t("workbooks.renameLabel")}
        className="h-auto max-w-2xl rounded-md px-2 py-1 text-2xl font-bold text-gray-900"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={t("workbooks.renameLabel")}
      className="group flex max-w-full items-center gap-2 text-left"
    >
      <h1 className="truncate text-2xl font-bold text-gray-900">{name}</h1>
      <Pencil className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
    </button>
  );
}
