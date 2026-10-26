"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";

import { useTranslation } from "@repo/i18n";

import { NoticeLine } from "./notice-line";

interface WelcomeNoticeProps {
  locale: string;
  onDismiss: () => void;
}

export function WelcomeNotice({ locale, onDismiss }: WelcomeNoticeProps) {
  const { t } = useTranslation();

  return (
    <NoticeLine onDismiss={onDismiss}>
      {t("dashboard.welcomeNotice")}{" "}
      <IntentLink
        href={`/${locale}/platform/transfer-request`}
        className="font-semibold underline-offset-2 hover:underline"
      >
        {t("dashboard.requestTransfer")}
      </IntentLink>
    </NoticeLine>
  );
}
