"use client";

import { useLocale } from "@/hooks/useLocale";
import { Building2, FlaskConical, Globe } from "lucide-react";

import { useTranslation } from "@repo/i18n";

import { FirstWorkCard } from "./first-work-card";

/** Where a researcher with no experiments of their own can start. */
export function FirstWorkCards() {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <FirstWorkCard
        href={`/${locale}/platform/experiments/new`}
        icon={FlaskConical}
        title={t("dashboard.firstWork.create.title")}
        description={t("dashboard.firstWork.create.description")}
      />
      <FirstWorkCard
        href={`/${locale}/platform/organizations`}
        icon={Building2}
        title={t("dashboard.firstWork.join.title")}
        description={t("dashboard.firstWork.join.description")}
      />
      <FirstWorkCard
        href={`/${locale}/platform/experiments?visibility=public&focus=search`}
        icon={Globe}
        title={t("dashboard.firstWork.browse.title")}
        description={t("dashboard.firstWork.browse.description")}
      />
    </div>
  );
}
