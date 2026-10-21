"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { Archive, Globe, Lock, Snowflake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@repo/i18n";

interface Commitment {
  icon: LucideIcon;
  text: string;
}

export function FreezeCommitsCard() {
  const { t } = useTranslation("datasets");

  const commitments: Commitment[] = [
    { icon: Globe, text: t("freeze.commits.public") },
    { icon: Snowflake, text: t("freeze.commits.frozen") },
    { icon: Lock, text: t("freeze.commits.final") },
    { icon: Archive, text: t("freeze.commits.experiment") },
  ];

  const renderCommitment = ({ icon: Icon, text }: Commitment) => (
    <li key={text} className="flex items-start gap-3 text-sm">
      <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </li>
  );

  return (
    <SettingsCard title={t("freeze.commitsTitle")} data-testid="freeze-commits">
      <ul className="space-y-2.5">{commitments.map(renderCommitment)}</ul>
    </SettingsCard>
  );
}
