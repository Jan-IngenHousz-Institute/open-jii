"use client";

import { ProtocolSettings } from "@/components/protocol-settings";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { use } from "react";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";

interface ProtocolSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolSettingsPage({ params }: ProtocolSettingsPageProps) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { data: protocolData, isLoading } = useProtocol(id);
  const { t } = useTranslation();

  // Show loading state
  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  // Check if user is authenticated
  if (!session?.user.id) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("errors.unauthorized")}</h4>
          <p className="text-muted-foreground text-sm">{t("errors.loginRequired")}</p>
        </div>
      </div>
    );
  }

  // Check if protocol exists
  if (!protocolData?.body) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("protocols.notFound")}</h4>
          <p className="text-muted-foreground text-sm">{t("protocols.notFoundDescription")}</p>
        </div>
      </div>
    );
  }

  // Check if current user is the creator
  const isCreator = protocolData.body.createdBy === session.user.id;

  if (!isCreator) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("errors.forbidden")}</h4>
          <p className="text-muted-foreground text-sm">{t("protocols.onlyCreatorCanEdit")}</p>
        </div>
      </div>
    );
  }

  return <ProtocolSettings protocolId={id} />;
}
