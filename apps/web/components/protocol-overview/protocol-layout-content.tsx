"use client";

import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { ResourceDetailTabs } from "@/components/sharing/resource-detail-tabs";
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
  /**
   * The tester subroute renders through this same shell, but it is a full-page
   * tool with its own Back action — no tab strip belongs above it.
   */
  showTabs?: boolean;
}

export function ProtocolLayoutContent({
  id,
  protocol,
  children,
  actions,
  showTabs = true,
}: ProtocolLayoutContentProps) {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  // Renaming is a content edit → `canUpdate`.
  const { canUpdate, canShare, canLeave } = protocol.capabilities;

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

      {/* The strip sits in the layout, so Overview and Collaborators are routes
          under the same title rather than two states of one page. */}
      {showTabs ? (
        <ResourceDetailTabs
          resourceType="protocol"
          resourceId={id}
          canShare={canShare}
          canLeave={canLeave}
        >
          {children}
        </ResourceDetailTabs>
      ) : (
        children
      )}
    </div>
  );
}
