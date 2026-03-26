"use client";

import { IotProtocolRunner } from "@/components/iot/iot-protocol-runner";
import { ProtocolCodePanel } from "@/components/shared/protocol-code-panel";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useLocale } from "@/hooks/useLocale";
import { useProtocolCodeAutoSave } from "@/hooks/useProtocolCodeAutoSave";
import { ArrowLeft, MonitorX } from "lucide-react";
import Link from "next/link";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { SensorFamily } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface ProtocolRunContentProps {
  protocolId: string;
}

export function ProtocolRunContent({ protocolId }: ProtocolRunContentProps) {
  const locale = useLocale();
  const { data: protocolData, isLoading } = useProtocol(protocolId);
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { t: tIot } = useTranslation("iot");

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

  const protocolCode = (isEditing ? editedCode : protocol.code) as Record<string, unknown>[];

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[500px] flex-col">
      {/* Top bar — inline with the layout title */}
      <div className="-mt-10 mb-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/platform/protocols/${protocolId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("experiments.back")}
          </Link>
        </Button>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
        {/* Left Panel — Code Editor */}
        <ResizablePanel defaultSize={browserSupport.any ? 55 : 85} minSize={30}>
          <div className="h-full min-h-[200px]">
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
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel — IoT Runner */}
        <ResizablePanel
          defaultSize={browserSupport.any ? 45 : 15}
          minSize={browserSupport.any ? 20 : 10}
        >
          <div
            className={cn(
              "flex h-full min-w-0 flex-col overflow-hidden",
              !browserSupport.any && "bg-muted/30",
            )}
          >
            <div className="flex w-full items-center border-b px-2.5 py-2.5 sm:px-4">
              <span className="text-sm font-medium">{t("protocolSettings.testerTitle")}</span>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto p-2.5 sm:p-4">
              {browserSupport.any ? (
                <IotProtocolRunner
                  protocolCode={protocolCode}
                  sensorFamily={protocol.family}
                  layout="vertical"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MonitorX className="text-muted-foreground mx-auto mb-2 h-6 w-6" />
                    <div className="text-muted-foreground text-xs">
                      {tIot("iot.protocolRunner.browserNotSupported")}
                    </div>
                    <div className="text-muted-foreground/60 text-xs">
                      {tIot("iot.protocolRunner.tryDifferentBrowser")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
