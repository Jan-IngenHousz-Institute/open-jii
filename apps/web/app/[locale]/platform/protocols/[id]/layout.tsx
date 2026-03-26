"use client";

import { ProtocolLayoutContent } from "@/components/protocol-overview/protocol-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useLocale } from "@/hooks/useLocale";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { data, isLoading, error } = useProtocol(id);

  const isOverview = pathname === `/${locale}/platform/protocols/${id}`;
  const isRun = pathname === `/${locale}/platform/protocols/${id}/run`;

  const actions = isOverview ? (
    <Button size="sm" asChild>
      <Link href={`/${locale}/platform/protocols/${id}/run`}>
        <Play className="mr-2 h-4 w-4" />
        {t("protocolSettings.testerTitle")}
      </Link>
    </Button>
  ) : isRun ? (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/${locale}/platform/protocols/${id}`}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("experiments.back")}
      </Link>
    </Button>
  ) : undefined;

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data?.body}
      loadingMessage={t("protocols.loadingProtocols")}
      errorDescription={t("protocols.notFoundDescription")}
    >
      {data?.body && (
        <ProtocolLayoutContent id={id} protocol={data.body} actions={actions}>
          {children}
        </ProtocolLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
