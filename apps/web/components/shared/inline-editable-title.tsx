"use client";

import { Check, Pencil, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { cva } from "@repo/ui/lib/utils";

interface InlineEditableTitleProps {
  name: string;
  hasAccess?: boolean;
  onSave: (newName: string) => Promise<void>;
  isPending?: boolean;
  badges?: ReactNode;
  actions?: ReactNode;
}

const titleVariants = cva("text-2xl transition-all duration-300", {
  variants: {
    editable: {
      true: "hover:bg-muted -ml-2 cursor-pointer rounded-md px-2 group",
      false: "",
    },
  },
  defaultVariants: {
    editable: false,
  },
});

export function InlineEditableTitle({
  name,
  hasAccess = false,
  onSave,
  isPending = false,
  badges,
  actions,
}: InlineEditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  const handleClick = () => {
    if (hasAccess) {
      setEditedTitle(name);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTitle("");
  };

  const handleSave = async () => {
    if (!editedTitle.trim() || editedTitle === name) {
      setIsEditing(false);
      return;
    }

    await onSave(editedTitle);
    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.dataset.role === "edit-action") return;
    handleCancel();
  };

  return (
    <div className="flex items-center justify-between">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="text-2xl font-semibold"
            disabled={isPending}
            autoFocus
            onBlur={handleBlur}
          />
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isPending}
            data-role="edit-action"
            aria-label="Cancel"
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            data-role="edit-action"
            aria-label="Save"
          >
            <Check className="h-6 w-6" />
          </Button>
        </div>
      ) : (
        <CardTitle className={titleVariants({ editable: hasAccess })} onClick={handleClick}>
          {name}
          {hasAccess && (
            <Pencil className="text-muted-foreground ml-2 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </CardTitle>
      )}

      {(badges ?? actions) && (
        <div className="flex items-center gap-2">
          {badges}
          {actions}
        </div>
      )}
    </div>
  );
}
