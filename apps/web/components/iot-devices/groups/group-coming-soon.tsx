"use client";

import { ComingSoonPanel } from "@/components/iot-devices/coming-soon-panel";

import { useTranslation } from "@repo/i18n";

interface GroupComingSoonProps {
  section: "credentials" | "monitoring";
}

export function GroupComingSoon({ section }: GroupComingSoonProps) {
  const { t } = useTranslation("iot");

  return <ComingSoonPanel description={t(`iot.groups.comingSoon.${section}`)} />;
}
