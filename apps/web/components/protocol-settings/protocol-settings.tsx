"use client";

import { useTranslation } from "@repo/i18n";

import { useProtocol } from "../../hooks/protocol/useProtocol/useProtocol";
import { ProtocolCompatibleMacrosCard } from "./protocol-compatible-macros-card";
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
    <div className="space-y-6">
      {/* Edit Protocol Details Card - First */}
      <ProtocolDetailsCard
        protocolId={protocolId}
        initialName={protocol.name}
        initialDescription={protocol.description ?? ""}
        initialCode={protocol.code}
        initialFamily={protocol.family}
      />

      {/* Compatible Macros Card */}
      <ProtocolCompatibleMacrosCard protocolId={protocolId} />

      {/* Protocol Info Card - Last */}
      <ProtocolInfoCard protocolId={protocolId} protocol={protocol} />
    </div>
  );
}
