"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { ResourceDetailTabs } from "@/components/sharing/resource-detail-tabs";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { Code } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import type { MacroDetail } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

interface MacroLayoutContentProps {
  id: string;
  macro: MacroDetail;
  children: React.ReactNode;
}

export function MacroLayoutContent({ id, macro, children }: MacroLayoutContentProps) {
  const { t } = useTranslation(["macro", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(id);

  // Renaming is a content edit → `canUpdate`, not ownership.
  const { canUpdate, canShare, canLeave } = macro.capabilities;

  const handleTitleSave = async (newName: string) => {
    await updateMacro(
      { id, name: newName },
      {
        onSuccess: () => {
          toast({ description: t("macros.macroUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <InlineEditableTitle
        name={macro.name}
        hasAccess={canUpdate}
        onSave={handleTitleSave}
        isPending={isUpdating}
        icon={<Code className="h-6 w-6" />}
        badges={
          macro.sortOrder !== null ? (
            <Badge className="bg-secondary/30 text-primary">{tCommon("common.preferred")}</Badge>
          ) : undefined
        }
      />

      {/* The strip sits in the layout, so Overview and Collaborators are routes
          under the same title rather than two states of one page. */}
      <ResourceDetailTabs
        resourceType="macro"
        resourceId={id}
        canShare={canShare}
        canLeave={canLeave}
      >
        {children}
      </ResourceDetailTabs>
    </div>
  );
}
