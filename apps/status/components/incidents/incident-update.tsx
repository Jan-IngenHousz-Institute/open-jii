"use client";

import { useFormat } from "~/hooks/use-format";
import type { IncidentUpdateEntry } from "~/lib/incidents";

import { useTranslation } from "@repo/i18n/client";

interface IncidentUpdateProps {
  update: IncidentUpdateEntry;
  isLatest: boolean;
}

export function IncidentUpdate({ update, isLatest }: IncidentUpdateProps) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const postedAt = t("incident.postedAt", {
    date: format.monthDay(update.postedAt),
    time: format.time(update.postedAt),
  });
  const nextUpdateBy = isLatest ? update.nextUpdateBy : undefined;

  return (
    <div className="border-border mt-4 grid gap-3 border-t pt-4 md:grid-cols-[9rem_1fr]">
      <p className="text-sm">
        <span className="block font-semibold">{t(`incident.stage.${update.stage}`)}</span>
        <span className="text-muted-foreground">{postedAt}</span>
      </p>
      <div className="text-sm leading-relaxed">
        <p className="whitespace-pre-line">{update.text}</p>
        {nextUpdateBy === undefined ? null : (
          <p className="text-muted-foreground mt-1">
            {t("incident.nextUpdateBy", { time: format.time(nextUpdateBy) })}
          </p>
        )}
      </div>
    </div>
  );
}
