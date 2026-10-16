"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";

import { READ_EACH_VISIT, homeExperimentsQuery } from "./dashboard-queries";
import { DashboardSection } from "./dashboard-section";
import { FirstWorkCards } from "./first-work-cards";

/** Three places to start, for a researcher with no related experiments yet. */
export function GetStartedSection() {
  const { t } = useTranslation();
  const { data } = useQuery({ ...homeExperimentsQuery(orpc), ...READ_EACH_VISIT });

  // A failed read is not an empty one: guidance for a newcomer would mislead anyone else.
  const hasNoExperiments = data?.experiments.length === 0;
  if (!hasNoExperiments) return null;

  return (
    <DashboardSection id="get-started" title={t("dashboard.getStarted")}>
      <FirstWorkCards />
    </DashboardSection>
  );
}
