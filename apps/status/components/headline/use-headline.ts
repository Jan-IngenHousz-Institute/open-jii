"use client";

import { useFormat } from "~/hooks/use-format";
import { maintenanceEndsAt } from "~/lib/incidents";

import { useTranslation } from "@repo/i18n/client";
import type { Incident, StatusComponent } from "@repo/monitoring/status-document";

export interface HeadlineInput {
  components: Pick<StatusComponent, "id" | "state">[];
  openWindows: Incident[];
  generatedAt: string;
  isStale: boolean;
  isAllOperational: boolean;
}

export type HeadlineSeverity = "operational" | "degraded" | "outage" | "maintenance" | "stale";

// Down or degraded components win over planned work, and old data wins over everything.
export function useHeadline(input: HeadlineInput) {
  const { components, openWindows, generatedAt, isStale, isAllOperational } = input;
  const { t } = useTranslation("status");
  const format = useFormat();

  function idsIn(state: StatusComponent["state"]) {
    return components.filter((component) => component.state === state).map(({ id }) => id);
  }

  function namesIn(state: StatusComponent["state"]) {
    return idsIn(state).map((id) => t(`component.${id}.name`));
  }

  function sentence(key: string, names: string[], extra = {}) {
    const values = { count: names.length, names: format.names(names), ...extra };

    return names.length === 0 ? [] : [t(key, values)];
  }

  function severityOf(): HeadlineSeverity {
    if (isStale) {
      return "stale";
    }
    if (isAllOperational) {
      return "operational";
    }
    if (idsIn("outage").length > 0) {
      return "outage";
    }

    return idsIn("degraded").length > 0 ? "degraded" : "maintenance";
  }

  function maintenanceSentence() {
    const names = namesIn("maintenance");
    const endsAt = maintenanceEndsAt(openWindows, idsIn("maintenance"));

    if (endsAt === undefined) {
      return sentence("headline.maintenance", names);
    }

    // Contract times are UTC with a Z, so the first ten characters are the UTC day.
    const endsToday = endsAt.slice(0, 10) === generatedAt.slice(0, 10);
    const time = endsToday ? format.time(endsAt) : format.dateTime(endsAt);

    return sentence("headline.maintenanceUntil", names, { time });
  }

  function titleFor(severity: HeadlineSeverity) {
    switch (severity) {
      case "stale":
        return t("headline.stale.title");
      case "operational":
        return t("headline.operational.title");
      case "maintenance":
        return maintenanceSentence().join(" ");
      default:
        return [
          ...sentence("headline.outage", namesIn("outage")),
          ...sentence("headline.degraded", namesIn("degraded")),
        ].join(" ");
    }
  }

  function descriptionFor(severity: HeadlineSeverity) {
    switch (severity) {
      case "stale":
        return t("headline.stale.description");
      case "operational":
        return t("headline.operational.description");
      default:
        return sentence("headline.othersOperational", namesIn("operational")).join(" ");
    }
  }

  const severity = severityOf();

  return { severity, title: titleFor(severity), description: descriptionFor(severity) };
}
