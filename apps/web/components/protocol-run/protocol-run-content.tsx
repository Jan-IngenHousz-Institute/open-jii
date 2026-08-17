"use client";

import { IotProtocolRunner } from "@/components/iot/iot-protocol-runner";
import { CodeTesterLayout } from "@/components/shared/code-tester-layout";
import { ProtocolCodePanel } from "@/components/shared/protocol-code-panel";
import type { ProtocolCode } from "@/components/shared/protocol-code-panel";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useAutosave } from "@/hooks/useAutosave";
import { useCallback, useState } from "react";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface ProtocolRunContentProps {
  protocolId: string;
}

// The on-device runner only understands MultispeQ-style arrays of protocol
// sets; an array holding scalars or nested arrays is not runnable either.
function isRunnableCode(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
  );
}

export function ProtocolRunContent({ protocolId }: ProtocolRunContentProps) {
  const { data: protocolData, isLoading } = useProtocol(protocolId);
  const { t } = useTranslation();

  const family = protocolData?.family;
  const browserSupport = useIotBrowserSupport(family);

  const { mutateAsync: updateProtocol } = useProtocolUpdate(protocolId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<ProtocolCode>();

  const save = useCallback(
    async (code: ProtocolCode) => {
      try {
        await updateProtocol({
          id: protocolId,
          code,
        });
      } catch (err) {
        toast({ description: parseApiError(err)?.message, variant: "destructive" });
        throw err;
      }
    },
    [protocolId, updateProtocol],
  );

  const autosave = useAutosave<ProtocolCode>({
    value: editedCode,
    toKey: (code) => JSON.stringify(code),
    // See protocol-overview-content: any parsed document saves; undefined is
    // mid-keystroke text, and a bare string would look double-encoded.
    isValid: (value) => value !== undefined && typeof value !== "string",
    save,
    enabled: isEditing,
  });

  const startEditing = (initial: ProtocolCode) => {
    setEditedCode(initial);
    setIsEditing(true);
  };
  const closeEditing = async () => {
    await autosave.flush();
    setIsEditing(false);
  };

  const protocol = protocolData;
  // Capability, not ownership — the run view edits the same protocol code
  // as the detail page, so it must honour the same grant-derived permission.
  const canEditCode = protocol?.capabilities.canUpdate ?? false;

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
  // While the editor holds raw text, or the stored code is a non-runnable
  // document from another device family, fall back to the last stored code
  // if it is runnable.
  const fallbackCode = isRunnableCode(rawCode) ? rawCode : protocol.code;
  const protocolCode = isRunnableCode(fallbackCode) ? fallbackCode : [];

  const codePanel = (
    <ProtocolCodePanel
      code={protocol.code}
      canEdit={canEditCode}
      isEditing={isEditing}
      editedCode={editedCode}
      handleChange={setEditedCode}
      status={autosave.status}
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
