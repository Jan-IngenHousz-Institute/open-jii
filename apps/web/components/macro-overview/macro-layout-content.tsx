"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { parseApiError } from "~/util/apiError";

import type { Macro } from "@repo/api/schemas/macro.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

interface MacroLayoutContentProps {
  id: string;
  macro: Macro;
  children: React.ReactNode;
}

export function MacroLayoutContent({ id, macro, children }: MacroLayoutContentProps) {
  const { t } = useTranslation(["macro", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(id);

  const isCreator = session?.user.id === macro.createdBy;

  const handleTitleSave = async (newName: string) => {
    await updateMacro(
      { params: { id }, body: { name: newName } },
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
        hasAccess={isCreator}
        onSave={handleTitleSave}
        isPending={isUpdating}
        badges={
          macro.sortOrder !== null ? (
            <Badge className="bg-secondary/30 text-primary">{tCommon("common.preferred")}</Badge>
          ) : undefined
        }
      />
      {children}
    </div>
  );
}
