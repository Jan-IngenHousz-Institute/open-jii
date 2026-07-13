"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useCommandUpdate } from "@/hooks/command/useCommandUpdate/useCommandUpdate";
import { FileSliders } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import type { Command } from "@repo/api/schemas/command.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

interface CommandLayoutContentProps {
  id: string;
  command: Command;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function CommandLayoutContent({
  id,
  command,
  children,
  actions,
}: CommandLayoutContentProps) {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { mutateAsync: updateCommand, isPending: isUpdating } = useCommandUpdate(id);

  const isCreator = session?.user.id === command.createdBy;

  const handleTitleSave = async (newName: string) => {
    await updateCommand(
      { params: { id }, body: { name: newName } },
      {
        onSuccess: () => {
          toast({ description: t("commands.commandUpdated") });
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
        name={command.name}
        hasAccess={isCreator}
        onSave={handleTitleSave}
        isPending={isUpdating}
        icon={<FileSliders className="h-6 w-6" />}
        badges={
          command.sortOrder !== null ? (
            <Badge className="bg-secondary/30 text-primary">{tCommon("common.preferred")}</Badge>
          ) : undefined
        }
        actions={actions}
      />
      {children}
    </div>
  );
}
