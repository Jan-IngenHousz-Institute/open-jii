"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { FileSliders } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import type { ProtocolDetail } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

interface ProtocolLayoutContentProps {
  id: string;
  protocol: ProtocolDetail;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ProtocolLayoutContent({
  id,
  protocol,
  children,
  actions,
}: ProtocolLayoutContentProps) {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  // Renaming is a content edit → `canUpdate`.
  const { canUpdate } = protocol.capabilities;

  const handleTitleSave = async (newName: string) => {
    await updateProtocol(
      { id, name: newName },
      {
        onSuccess: () => {
          toast({ description: t("protocols.protocolUpdated") });
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
        name={protocol.name}
        hasAccess={canUpdate}
        onSave={handleTitleSave}
        isPending={isUpdating}
        icon={<FileSliders className="h-6 w-6" />}
        badges={
          protocol.sortOrder !== null ? (
            <Badge className="bg-secondary/30 text-primary">{tCommon("common.preferred")}</Badge>
          ) : undefined
        }
        actions={actions}
      />
      {children}
    </div>
  );
}
