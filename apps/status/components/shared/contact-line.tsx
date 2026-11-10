"use client";

import { Trans, useTranslation } from "@repo/i18n/client";

// The docs page the platform's own Report bug link opens.
const GETTING_HELP_URL = "https://docs.openjii.org/guide/reference/getting-help";

interface ContactLineProps {
  i18nKey: "headline.operational.help" | "unavailable.help";
}

export function ContactLine({ i18nKey }: ContactLineProps) {
  const { t } = useTranslation("status");

  return (
    <p className="text-muted-foreground mt-2 text-sm">
      <Trans
        t={t}
        i18nKey={i18nKey}
        components={{
          help: (
            <a
              href={GETTING_HELP_URL}
              className="text-primary font-medium underline underline-offset-4"
            />
          ),
        }}
      />
    </p>
  );
}
