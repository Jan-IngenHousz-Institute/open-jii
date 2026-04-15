"use client";

import { Check, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { RichTextarea } from "@repo/ui/components/rich-textarea";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cva } from "@repo/ui/lib/utils";

interface InlineEditableDescriptionProps {
  description: string;
  hasAccess?: boolean;
  onSave: (newDescription: string) => Promise<void>;
  isPending?: boolean;
  title?: string;
  saveLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}

const descriptionContainerVariants = cva("min-h-12 px-2 -ml-2 transition-all duration-300", {
  variants: {
    expanded: {
      true: "max-h-none",
      false: "max-h-64 overflow-hidden",
    },
    isShort: {
      true: "max-h-none",
      false: "",
    },
    editable: {
      true: "hover:bg-muted cursor-pointer rounded-md group",
      false: "",
    },
  },
  defaultVariants: {
    expanded: false,
    isShort: false,
    editable: false,
  },
});

const MIN_EXPAND_LENGTH = 700;

export function InlineEditableDescription({
  description,
  hasAccess = false,
  onSave,
  isPending = false,
  title = "Description",
  saveLabel = "Save",
  cancelLabel = "Cancel",
  placeholder = "Add a description...",
}: InlineEditableDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");

  const isShort = !description || description.length < MIN_EXPAND_LENGTH;

  const handleClick = () => {
    if (hasAccess && !isEditing) {
      setEditedDescription(description);
      setIsEditing(true);
      setIsExpanded(true);
      return;
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedDescription("");
  };

  const handleSave = async () => {
    if (editedDescription === description) {
      setIsEditing(false);
      return;
    }

    await onSave(editedDescription);
    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.dataset.role === "edit-action") return;
    handleCancel();
  };

  return (
    <div className="space-y-0">
      <h2 className="font-bold">{title}</h2>

      {isEditing ? (
        <div className="space-y-2">
          <RichTextarea
            value={editedDescription}
            onChange={setEditedDescription}
            placeholder={placeholder}
            isDisabled={isPending}
            autoFocus
            onBlur={handleBlur}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isPending}
              data-role="edit-action"
            >
              <X className="h-4 w-4" />
              <span>{cancelLabel}</span>
            </Button>
            <Button onClick={handleSave} disabled={isPending} data-role="edit-action">
              <Check className="h-4 w-4" />
              <span>{saveLabel}</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <div
              className={descriptionContainerVariants({
                expanded: isExpanded,
                isShort,
                editable: hasAccess,
              })}
              onClick={handleClick}
            >
              {hasAccess && (
                <Pencil className="text-muted-foreground absolute right-2 top-2 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
              <RichTextRenderer content={description} />
            </div>

            {!isShort && !isExpanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 -ml-2 h-16 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>

          {!isShort && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronUp className="!h-6 !w-6" />
              ) : (
                <ChevronDown className="!h-6 !w-6" />
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
