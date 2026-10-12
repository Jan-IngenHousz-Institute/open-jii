"use client";

import { useLocale } from "@/hooks/useLocale";
import { Building2, FlaskConical, Globe } from "lucide-react";
import { ResourceCardGrid } from "~/components/shared/resource-card";

import { useTranslation } from "@repo/i18n";

import { FirstWorkCard } from "./first-work-card";

const FIRST_WORK = [
  { key: "create", path: "/platform/experiments/new", icon: FlaskConical },
  { key: "join", path: "/platform/organizations", icon: Building2 },
  { key: "browse", path: "/platform/experiments?visibility=public&focus=search", icon: Globe },
] as const;

/** Where a researcher who has opened no related experiment yet can start. */
export function FirstWorkCards() {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <ResourceCardGrid>
      {FIRST_WORK.map(({ key, path, icon }) => (
        <FirstWorkCard
          key={key}
          href={`/${locale}${path}`}
          icon={icon}
          title={t(`dashboard.firstWork.${key}.title`)}
          description={t(`dashboard.firstWork.${key}.description`)}
        />
      ))}
    </ResourceCardGrid>
  );
}
