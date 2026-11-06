"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { ReactNode } from "react";
import { HistoryStrip } from "~/components/history/history-strip";
import { ProblemDays } from "~/components/history/problem-days";
import { useVisibleDays } from "~/components/history/use-visible-days";
import { StatusBadge } from "~/components/shared/status-badge";
import { useFormat } from "~/hooks/use-format";

import { useTranslation } from "@repo/i18n/client";
import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";
import type { Incident, StatusComponent } from "@repo/monitoring/status-document";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

interface ComponentRowProps {
  component: StatusComponent;
  incidents: Incident[];
  today: string;
  isStale: boolean;
  adornment?: ReactNode;
}

export function ComponentRow({
  component,
  incidents,
  today,
  isStale,
  adornment,
}: ComponentRowProps) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const dayCount = useVisibleDays();
  const id = useId();
  const badgeId = `${id}-state`;
  const uptimeId = `${id}-uptime`;
  const checksBegan = component.days.at(0)?.date ?? today;
  const text = (field: "name" | "description" | "details") =>
    t(`component.${component.id}.${field}`);
  const hasFullHistory = component.days.length >= STATUS_HISTORY_DAYS;
  const uptime = format.uptime(component.uptimePercent);
  const uptimeLine = hasFullHistory
    ? t("history.uptime", { uptime })
    : t("history.uptimeSince", { uptime, date: format.date(checksBegan) });

  return (
    <Collapsible className="border-border border-t px-6 py-5 first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h3>
            <CollapsibleTrigger className="text-foreground hover:text-primary group block hyphens-auto break-words text-left font-semibold">
              {text("name")}
              <ChevronDown
                className="text-muted-foreground ml-1.5 inline size-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {text("description")}
            {component.delayMinutes === undefined ? null : (
              <span className="text-status-stale-foreground ml-1 font-medium">
                {t("component.delayNow", { minutes: component.delayMinutes })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          {adornment}
          <span id={badgeId}>
            <StatusBadge state={component.state} isMuted={isStale} />
          </span>
        </div>
      </div>

      <CollapsibleContent>
        <p className="mt-3 max-w-prose text-sm leading-relaxed">{text("details")}</p>
        <ProblemDays days={component.days} incidents={incidents} checksBegan={checksBegan} />
      </CollapsibleContent>

      <div className="mt-4">
        <HistoryStrip
          component={component}
          incidents={incidents}
          checksBegan={checksBegan}
          dayCount={dayCount}
          describedBy={`${badgeId} ${uptimeId}`}
        />
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-y-1 text-xs">
        <span>{t("history.daysAgo", { days: dayCount })}</span>
        <span id={uptimeId} className="order-last basis-full sm:order-none sm:basis-auto">
          <span className="text-foreground font-semibold">{uptimeLine}</span> ·{" "}
          {t("history.degraded", { degraded: format.duration(component.degradedMinutes) })}
        </span>
        <span>{t("history.today")}</span>
      </div>
    </Collapsible>
  );
}
