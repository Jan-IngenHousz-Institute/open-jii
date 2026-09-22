"use client";

import { useLocale } from "@/hooks/useLocale";

import { useTranslation } from "@repo/i18n";

import { ActionChipLink } from "./action-chip-link";
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
    <ActionChipLink href={`/${locale}/platform/devices/${deviceId}/${target.tab}`}>
      {t(target.labelKey)}
    </ActionChipLink>
  );
}
