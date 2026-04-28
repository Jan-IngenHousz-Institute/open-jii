"use client";

import { IotProtocolRunner } from "@/components/iot/iot-protocol-runner";
import { CodeTesterLayout } from "@/components/shared/code-tester-layout";
import { ProtocolCodePanel } from "@/components/shared/protocol-code-panel";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolCodeAutoSave } from "@/hooks/useProtocolCodeAutoSave";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";

interface ProtocolRunContentProps {
  protocolId: string;
}

export function ProtocolRunContent({ protocolId }: ProtocolRunContentProps) {
  const { data: protocolData, isLoading } = useProtocol(protocolId);
  const { data: session } = useSession();
  const { t } = useTranslation();

  const family = (protocolData?.body as { family?: SensorFamily } | undefined)?.family;
  const browserSupport = useIotBrowserSupport(family);

  const { editedCode, syncStatus, startEditing, closeEditing, handleChange, isEditing } =
    useProtocolCodeAutoSave(protocolId);

  const protocol = protocolData?.body;
  const isCreator = session?.user.id === protocol?.createdBy;

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (!protocol) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("protocols.notFound")}</h4>
          <p className="text-muted-foreground text-sm">{t("protocols.notFoundDescription")}</p>
        </div>
      </div>
    );
  }

  const rawCode = isEditing ? editedCode : protocol.code;
  const protocolCode = Array.isArray(rawCode) ? rawCode : protocol.code;

  const codePanel = (
    <ProtocolCodePanel
      code={protocol.code}
      isCreator={isCreator}
      isEditing={isEditing}
      editedCode={editedCode}
      handleChange={handleChange}
      syncStatus={syncStatus}
      closeEditing={closeEditing}
      startEditing={() => startEditing(protocol.code)}
      placeholder={t("newProtocol.codePlaceholder")}
      height="100%"
      borderless
    />
  );

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[500px] flex-col">
      <CodeTesterLayout
        codePanel={codePanel}
        testerPanel={
          <IotProtocolRunner
            protocolCode={protocolCode}
            sensorFamily={protocol.family}
            layout="vertical"
          />
        }
        testerTitle={t("protocolSettings.testerTitle")}
        browserSupport={browserSupport}
      />
    </div>
  );
}
