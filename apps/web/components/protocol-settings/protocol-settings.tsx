"use client";

import { useTranslation } from "@repo/i18n";

import { useProtocol } from "../../hooks/protocol/useProtocol/useProtocol";
import { ProtocolDetailsCard } from "./protocol-details-card";
import { ProtocolInfoCard } from "./protocol-info-card";

interface ProtocolSettingsProps {
  protocolId: string;
}

export function ProtocolSettings({ protocolId }: ProtocolSettingsProps) {
  const { data, isLoading } = useProtocol(protocolId);
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("protocolSettings.loading")}</div>;
  }

  if (!data) {
    return <div>{t("protocolSettings.notFound")}</div>;
  }

  const protocol = data.body;

  return (
    <div className="flex flex-col gap-6">
      {/* Edit Protocol Details - Split Panel */}
      <ProtocolDetailsCard
        protocolId={protocolId}
        initialName={protocol.name}
        initialDescription={protocol.description ?? ""}
        initialCode={protocol.code}
        initialFamily={protocol.family}
      />

      {/* Protocol Info Card */}
      <ProtocolInfoCard protocolId={protocolId} protocol={protocol} />
    </div>
  );
}
