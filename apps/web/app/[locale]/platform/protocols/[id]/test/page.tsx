"use client";

import { ErrorDisplay } from "@/components/error-display";
import { IotProtocolTester } from "@/components/iot/iot-protocol-tester";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ProtocolTestPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolTestPage({ params }: ProtocolTestPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.failedToLoadProtocol")} />;
  }

  if (!data) {
    return <div>{t("protocols.notFound")}</div>;
  }

  const protocol = data.body;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Test Protocol</h3>
        <p className="text-muted-foreground text-sm">Connect to a device and test your protocol</p>
      </div>
      <IotProtocolTester
        protocolCode={protocol.code}
        sensorFamily={protocol.family}
        protocolName={protocol.name}
      />
    </div>
  );
}
