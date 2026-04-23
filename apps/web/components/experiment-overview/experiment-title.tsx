"use client";

import { useExperimentUpdate } from "@/hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { Eye, EyeOff } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

import { InlineEditableTitle } from "../shared/inline-editable-title";

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
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const handleSave = async (newName: string) => {
    await updateExperiment(
      {
        params: { id: experimentId },
        body: { name: newName },
      },
      {
        onSuccess: () => {
          toast({ description: t("experiments.experimentUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-badge-active">{t("status.active")}</Badge>;
      case "archived":
        return <Badge className="bg-badge-archived">{t("status.archived")}</Badge>;
      case "stale":
        return <Badge className="bg-badge-stale">{t("status.stale")}</Badge>;
      case "published":
        return <Badge className="bg-badge-published">{t("status.published")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <InlineEditableTitle
      name={name}
      hasAccess={hasAccess && !isArchived}
      onSave={handleSave}
      isPending={isUpdating}
      badges={
        <>
          {getStatusBadge(status)}
          <Badge
            variant="outline"
            className={`ml-2 flex items-center gap-1 capitalize ${visibility === "private" ? "text-muted-foreground" : ""}`}
          >
            {visibility === "public" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {visibility}
          </Badge>
        </>
      }
    />
  );
}
