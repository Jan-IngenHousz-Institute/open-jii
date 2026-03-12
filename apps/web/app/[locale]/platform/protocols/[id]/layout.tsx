"use client";

import { ErrorDisplay } from "@/components/error-display";
import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { notFound, useParams } from "next/navigation";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { data: protocolData, isLoading, error } = useProtocol(id);
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">{t("protocols.loadingProtocols")}</div>
      </div>
    );
  }

  if (error) {
    const errorObj = error as { status?: number };
    const errorStatus = errorObj.status;

    if (errorStatus === 404 || errorStatus === 400) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{tCommon("errors.error")}</h3>
          <p className="text-muted-foreground text-sm">{t("protocols.notFoundDescription")}</p>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!protocolData?.body) {
    return null;
  }

  const protocol = protocolData.body;
  const isCreator = session?.user.id === protocol.createdBy;

  const handleTitleSave = async (newName: string) => {
    await updateProtocol(
      {
        params: { id },
        body: { name: newName },
      },
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
      />

      {children}
    </div>
  );
}
