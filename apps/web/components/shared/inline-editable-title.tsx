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
  /** When true, actions render right after the title instead of pushed to the row's far end. */
  actionsInline?: boolean;
  /** Center the title on mobile (left-aligned from `sm` up). */
  centerTitle?: boolean;
}

const rootVariants = cva("flex min-w-0 items-center gap-2", {
  variants: {
    actionsInline: { true: "", false: "justify-between" },
    centerTitle: { true: "w-full justify-center sm:w-auto sm:justify-start", false: "" },
  },
  defaultVariants: { actionsInline: false, centerTitle: false },
});

const editRowVariants = cva("flex min-w-0 items-center gap-2", {
  variants: {
    centerTitle: { true: "w-full", false: "flex-1" },
  },
  defaultVariants: { centerTitle: false },
});

const titleVariants = cva("text-2xl transition-all duration-300", {
  variants: {
    editable: {
      true: "hover:bg-muted -ml-2 cursor-pointer rounded-md px-2 group",
      false: "",
    },
    centerTitle: { true: "relative", false: "" },
  },
  defaultVariants: { editable: false, centerTitle: false },
});

const editIconVariants = cva(
  "text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100",
  {
    variants: {
      centerTitle: {
        true: "absolute left-full top-1/2 ml-2 -translate-y-1/2",
        false: "ml-2 inline",
      },
    },
    defaultVariants: { centerTitle: false },
  },
);

export function InlineEditableTitle({
  name,
  hasAccess = false,
  onSave,
  isPending = false,
  badges,
  actions,
  actionsInline = false,
  centerTitle = false,
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
    <div className={rootVariants({ actionsInline, centerTitle })}>
      {isEditing ? (
        <div className={editRowVariants({ centerTitle })}>
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
              }
            }}
            className="min-w-0 flex-1 text-lg font-semibold sm:text-2xl"
            disabled={isPending}
            autoFocus
            onBlur={handleBlur}
          />
          <Button
            variant="secondary"
            size="icon"
            className="shrink-0"
            onClick={handleCancel}
            disabled={isPending}
            data-role="edit-action"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSave}
            disabled={isPending}
            data-role="edit-action"
            aria-label="Save"
          >
            <Check className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <CardTitle
          className={titleVariants({ editable: hasAccess, centerTitle })}
          onClick={handleClick}
        >
          <span className="min-w-0 break-words">{name}</span>
          {hasAccess && <Pencil className={editIconVariants({ centerTitle })} />}
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
