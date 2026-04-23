"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { parseApiError } from "~/util/apiError";

import type { Protocol } from "@repo/api/schemas/protocol.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { toast } from "@repo/ui/hooks/use-toast";

interface ProtocolLayoutContentProps {
  id: string;
  protocol: Protocol;
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
  const { data: session } = useSession();
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  const isCreator = session?.user.id === protocol.createdBy;

  const handleTitleSave = async (newName: string) => {
    await updateProtocol(
      { params: { id }, body: { name: newName } },
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
        hasAccess={isCreator}
        onSave={handleTitleSave}
        isPending={isUpdating}
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
