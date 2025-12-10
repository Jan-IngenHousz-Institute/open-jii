"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { Badge, Button, CardTitle, Input } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface ExperimentTitleProps {
  experimentId: string;
  name: string;
  status: string;
  visibility: string;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentTitle({
  experimentId,
  name,
  status,
  visibility,
  hasAccess = false,
  isArchived = false,
}: ExperimentTitleProps) {
  const { t } = useTranslation("experiments");

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const handleTitleClick = () => {
    if (hasAccess && !isArchived) {
      setEditedTitle(name);
      setIsEditingTitle(true);
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const handleTitleSave = async () => {
    if (!editedTitle.trim() || editedTitle === name) {
      setIsEditingTitle(false);
      return;
    }

    await updateExperiment(
      {
        params: { id: experimentId },
        body: { name: editedTitle },
      },
      {
        onSuccess: () => {
          toast({ description: t("experiments.experimentUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
        onSettled: () => {
          setIsEditingTitle(false);
        },
      },
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-badge-active">{t("status.active")}</Badge>;
      case "provisioning":
        return <Badge className="bg-badge-provisioning">{t("status.provisioning")}</Badge>;
      case "archived":
        return <Badge className="bg-badge-archived">{t("status.archived")}</Badge>;
      case "stale":
        return <Badge className="bg-badge-stale">{t("status.stale")}</Badge>;
      case "provisioning_failed":
        return (
          <Badge className="bg-badge-provisioningFailed">{t("status.provisioningFailed")}</Badge>
        );
      case "published":
        return <Badge className="bg-badge-published">{t("status.published")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between">
      {isEditingTitle ? (
        <div className="flex items-center gap-2">
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="text-2xl font-semibold"
            disabled={isUpdating}
            autoFocus
            onBlur={(e) => {
              const next = e.relatedTarget as HTMLElement | null;

              if (next?.dataset.role === "edit-action") return;

              handleTitleCancel();
            }}
          />
          <Button
            variant="outline"
            onClick={handleTitleCancel}
            disabled={isUpdating}
            data-role="edit-action"
            className="hover:bg-badge-featured"
            aria-label="Cancel"
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            onClick={handleTitleSave}
            disabled={isUpdating}
            data-role="edit-action"
            className="text-primary hover:bg-badge-featured"
            aria-label="Save"
          >
            <Check className="h-6 w-6" />
          </Button>
        </div>
      ) : (
        <CardTitle
          className={`text-2xl transition-all duration-300 ${hasAccess && !isArchived ? "hover:bg-muted -ml-1 cursor-pointer rounded-md px-1" : ""}`}
          onClick={handleTitleClick}
        >
          {name}
        </CardTitle>
      )}

      <div className="flex items-center gap-2">
        {getStatusBadge(status)}
        <Badge
          variant="outline"
          className={`ml-2 flex items-center gap-1 capitalize ${visibility === "private" ? "text-muted-foreground" : ""}`}
        >
          {visibility === "public" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {visibility}
        </Badge>
      </div>
    </div>
  );
}
