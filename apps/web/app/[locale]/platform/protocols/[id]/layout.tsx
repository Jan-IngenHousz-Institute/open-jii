"use client";

import { ProtocolLayoutContent } from "@/components/protocol-overview/protocol-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading, error } = useProtocol(id);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data?.body}
      loadingMessage={t("protocols.loadingProtocols")}
      errorDescription={t("protocols.notFoundDescription")}
    >
      {data?.body && (
        <ProtocolLayoutContent id={id} protocol={data.body}>
          {children}
        </ProtocolLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
