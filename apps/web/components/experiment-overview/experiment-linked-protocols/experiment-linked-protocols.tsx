"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "~/hooks/useLocale";
import { parseApiError } from "~/util/apiError";

import type { FlowGraph } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardTitle } from "@repo/ui/components";

import { useExperimentFlow } from "../../../hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useProtocol } from "../../../hooks/protocol/useProtocol/useProtocol";
import { ProtocolCard, ProtocolSelector } from "./protocol-card";

interface ExperimentLinkedProtocolsProps {
  experimentId: string;
  isArchived?: boolean;
}

export function ExperimentLinkedProtocols({
  experimentId,
  isArchived = false,
}: ExperimentLinkedProtocolsProps) {
  const locale = useLocale();
  const { data: flowData, isLoading, error } = useExperimentFlow(experimentId);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>("");
  const { t } = useTranslation("experiments");
  // Fetch the selected protocol
  const {
    data: protocolData,
    isLoading: isProtocolLoading,
    error: protocolError,
  } = useProtocol(selectedProtocolId || "");

  // Extract protocol IDs from measurement nodes
  const protocolIds = useMemo(() => {
    if (!flowData?.body) return [];

    const graph: FlowGraph = flowData.body.graph;
    const measurementNodes = graph.nodes.filter(
      (node): node is typeof node & { content: { protocolId: string } } =>
        node.type === "measurement" &&
        "protocolId" in node.content &&
        typeof node.content.protocolId === "string",
    );

    // Get unique protocol IDs
    const uniqueIds = Array.from(new Set(measurementNodes.map((node) => node.content.protocolId)));

    return uniqueIds;
  }, [flowData]);

  // Auto-select the first protocol when protocols are loaded
  useEffect(() => {
    if (protocolIds.length > 0 && !selectedProtocolId) {
      setSelectedProtocolId(protocolIds[0]);
    }
  }, [protocolIds, selectedProtocolId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("protocols.linkedProtocols")}</CardTitle>
        <div className="animate-pulse space-y-2">
          <div className="h-[140px] rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (parseApiError(error)?.code === "NOT_FOUND") {
    return (
      <div className="space-y-4">
        <CardTitle>{t("protocols.linkedProtocols")}</CardTitle>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-muted-foreground mb-4 text-center text-sm">
              {t("protocols.noFlowYet")}
            </p>

            <Link
              href={`/${locale}/platform/${isArchived ? "experiments-archive" : "experiments"}/${experimentId}/flow`}
            >
              <Button variant="outline" className="bg-surface">
                {t("protocols.createFlow")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("protocols.linkedProtocols")}</CardTitle>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center text-sm">
              {t("protocols.unableToLoadExperimentFlow")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (protocolIds.length === 0) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("protocols.linkedProtocols")}</CardTitle>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-muted-foreground mb-4 text-center text-sm">
              {t("protocols.noProtocolsLinked")}
            </p>
            <Link
              href={`/${locale}/platform/${isArchived ? "experiments-archive" : "experiments"}/${experimentId}/flow`}
              passHref
            >
              <Button variant="outline" className="bg-surface">
                {t("protocols.goToFlow")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Multiple protocols - show select dropdown
  const selectedProtocol = protocolIds.find((id) => id === selectedProtocolId);

  return (
    <div className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <CardTitle>{t("protocols.linkedProtocols")}</CardTitle>
        {selectedProtocol && (
          <Link href={`/${locale}/platform/protocols/${selectedProtocol}`} className="shrink-0">
            <Button variant="ghost" className="text-primary h-auto p-0 hover:bg-transparent">
              {t("protocols.goToProtocol")}
            </Button>
          </Link>
        )}
      </div>
      <Card className="overflow-hidden">
        <CardContent className="bg-surface-light space-y-6 pt-6">
          <div>
            <ProtocolSelector
              protocolIds={protocolIds}
              selectedProtocolId={selectedProtocolId}
              selectedProtocolName={protocolData?.body.name}
              onProtocolChange={setSelectedProtocolId}
            />
          </div>
          {selectedProtocol && (
            <div className="mt-6 flex flex-col">
              <ProtocolCard
                protocol={protocolData?.body}
                isLoading={isProtocolLoading}
                error={protocolError}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
