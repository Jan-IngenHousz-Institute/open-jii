"use client";

import { guestMayUse } from "@/components/auth/guest-access";
import type { GuestGatedProcedure } from "@/components/auth/guest-access";
import { useIsGuest } from "@/components/auth/principal-context";
import { useLocale } from "@/hooks/useLocale";
import { Building2, FlaskConical, Globe } from "lucide-react";
import { ResourceCardGrid } from "~/components/shared/resource-card";

import { useTranslation } from "@repo/i18n";

import { FirstWorkCard } from "./first-work-card";

const FIRST_WORK: {
  key: string;
  path: string;
  icon: typeof Globe;
  procedure?: GuestGatedProcedure;
}[] = [
  {
    key: "create",
    path: "/platform/experiments/new",
    icon: FlaskConical,
    procedure: "experiments.createExperiment",
  },
  {
    key: "join",
    path: "/platform/organizations",
    icon: Building2,
    procedure: "organizations.createOrganizationJoinRequest",
  },
  { key: "browse", path: "/platform/experiments?visibility=public&focus=search", icon: Globe },
];

/** Where a researcher with no accessible related experiments can start. */
export function FirstWorkCards() {
  const { t } = useTranslation();
  const locale = useLocale();
  const isGuest = useIsGuest();

  return (
    <ResourceCardGrid>
      {FIRST_WORK.filter(({ procedure }) => guestMayUse(procedure, isGuest)).map(
        ({ key, path, icon }) => (
          <FirstWorkCard
            key={key}
            href={`/${locale}${path}`}
            icon={icon}
            title={t(`dashboard.firstWork.${key}.title`)}
            description={t(`dashboard.firstWork.${key}.description`)}
          />
        ),
      )}
    </ResourceCardGrid>
  );
}
