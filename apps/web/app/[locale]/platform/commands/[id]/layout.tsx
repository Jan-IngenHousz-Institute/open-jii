"use client";

import { CommandLayoutContent } from "@/components/command-overview/command-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useCommand } from "@/hooks/command/useCommand/useCommand";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

interface CommandLayoutProps {
  children: React.ReactNode;
}

export default function CommandLayout({ children }: CommandLayoutProps) {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { t: tIot } = useTranslation("iot");
  const { data, isLoading, error } = useCommand(id);
  const browserSupport = useIotBrowserSupport(data?.body.family);

  const isOverview = pathname === `/${locale}/platform/commands/${id}`;
  const isRun = pathname === `/${locale}/platform/commands/${id}/run`;

  const connectButton = (
    <Button size="sm" disabled={!browserSupport.any} asChild={browserSupport.any}>
      {browserSupport.any ? (
        <Link href={`/${locale}/platform/commands/${id}/run`}>
          <Play className="mr-2 h-4 w-4" />
          {t("commandSettings.testerTitle")}
        </Link>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          {t("commandSettings.testerTitle")}
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
        <TooltipContent>{tIot("iot.commandRunner.browserNotSupported")}</TooltipContent>
      </Tooltip>
    )
  ) : isRun ? (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/${locale}/platform/commands/${id}`}>
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
      loadingMessage={t("commands.loadingCommands")}
      errorDescription={t("commands.notFoundDescription")}
    >
      {data?.body && (
        <CommandLayoutContent id={id} command={data.body} actions={actions}>
          {children}
        </CommandLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
