"use client";

import { ProtocolLayoutContent } from "@/components/protocol-overview/protocol-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { t: tIot } = useTranslation("iot");
  const { data, isLoading, error } = useProtocol(id);
  const browserSupport = useIotBrowserSupport(data?.body.family);

  const isOverview = pathname === `/${locale}/platform/protocols/${id}`;
  const isRun = pathname === `/${locale}/platform/protocols/${id}/run`;

  const connectButton = (
    <Button size="sm" disabled={!browserSupport.any} asChild={browserSupport.any}>
      {browserSupport.any ? (
        <Link href={`/${locale}/platform/protocols/${id}/run`}>
          <Play className="mr-2 h-4 w-4" />
          {t("protocolSettings.testerTitle")}
        </Link>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          {t("protocolSettings.testerTitle")}
        </>
      )}
    </Button>
  );

  const actions = isOverview ? (
    browserSupport.any ? (
      connectButton
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>{connectButton}</TooltipTrigger>
        <TooltipContent>{tIot("iot.protocolRunner.browserNotSupported")}</TooltipContent>
      </Tooltip>
    )
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
