"use client";

import { useLocale } from "@/hooks/useLocale";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";

import type { DeviceNextAction } from "./device-next-action";

interface DeviceNextActionChipProps {
  deviceId: string;
  action: DeviceNextAction;
}

const ACTION_TARGET: Record<Exclude<DeviceNextAction, null>, { tab: string; labelKey: string }> = {
  issueCredentials: { tab: "credentials", labelKey: "iot.devices.nextAction.issueCredentials" },
  onboard: { tab: "onboarding", labelKey: "iot.devices.nextAction.onboard" },
};

/**
 * The single next-action chip: one computed step, deep-linking the tab where
 * it happens. Deliberately not a persistent lifecycle band; a fully set-up
 * device shows nothing.
 */
export function DeviceNextActionChip({ deviceId, action }: DeviceNextActionChipProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  if (action === null) {
    return null;
  }

  const target = ACTION_TARGET[action];

  return (
    <Link
      href={`/${locale}/platform/devices/${deviceId}/${target.tab}`}
      className="bg-secondary text-secondary-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium hover:opacity-90 focus-visible:ring-2"
    >
      {t(target.labelKey)}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
