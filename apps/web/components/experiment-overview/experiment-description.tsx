"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { Button, RichTextarea, RichTextRenderer } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";
import { cva } from "@repo/ui/lib/utils";

interface ExperimentDescriptionProps {
  experimentId: string;
  description: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentDescription({
  experimentId,
  description,
  hasAccess = false,
  isArchived = false,
}: ExperimentDescriptionProps) {
  const { t } = useTranslation("experiments");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");

  const MIN_EXPAND_LENGTH = 700;
  const isDescriptionShort = !description || description.length < MIN_EXPAND_LENGTH;

  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const descriptionContainerVariants = cva("transition-all duration-300", {
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
        true: "hover:bg-muted cursor-pointer rounded-md",
        false: "",
      },
    },
    defaultVariants: {
      expanded: false,
      isShort: false,
      editable: false,
    },
  });

  const handleDescriptionClick = () => {
    if (hasAccess && !isEditingDescription && !isArchived) {
      setEditedDescription(description);
      setIsEditingDescription(true);
      setIsDescriptionExpanded(true);
      return;
    }

    if (isDescriptionShort) return;
  };

  const handleDescriptionCancel = () => {
    setIsEditingDescription(false);
    setEditedDescription("");
  };

  const handleDescriptionSave = async () => {
    if (editedDescription === description) {
      setIsEditingDescription(false);
      return;
    }

    await updateExperiment(
      {
        params: { id: experimentId },
        body: { description: editedDescription },
      },
      {
        onSuccess: () => {
          toast({ description: t("experiments.experimentUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
        onSettled: () => {
          setIsEditingDescription(false);
        },
      },
    );
  };

  return (
    <div className="space-y-0">
      <h2 className="font-bold">{t("descriptionTitle")}</h2>

      {isEditingDescription ? (
        <div className="space-y-2">
          <RichTextarea
            value={editedDescription}
            onChange={setEditedDescription}
            placeholder={t("form.descriptionPlaceholder")}
            isDisabled={isUpdating}
            autoFocus
            onBlur={(e: React.FocusEvent) => {
              const next = e.relatedTarget as HTMLElement | null;

              if (next?.dataset.role === "edit-action") return;

              handleDescriptionCancel();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleDescriptionCancel}
              disabled={isUpdating}
              data-role="edit-action"
              className="text-destructive hover:text-destructive/80 disabled:opacity-50"
            >
              <X className="mr-2 h-4 w-4" />
              {t("cancel")}
            </Button>
            <Button
              variant="outline"
              onClick={handleDescriptionSave}
              disabled={isUpdating}
              data-role="edit-action"
              className="text-primary hover:text-primary/80 disabled:opacity-50"
            >
              <Check className="mr-2 h-4 w-4" />
              {t("save")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <div
              className={descriptionContainerVariants({
                expanded: isDescriptionExpanded,
                isShort: isDescriptionShort,
                editable: hasAccess && !isArchived,
              })}
              onClick={handleDescriptionClick}
            >
              <RichTextRenderer content={description} />
            </div>

            {/* Fade gradient ONLY if long and collapsed */}
            {!isDescriptionShort && !isDescriptionExpanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>

          {/* Chevron button only if long */}
          {!isDescriptionShort && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="w-full hover:bg-transparent"
            >
              {isDescriptionExpanded ? (
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
