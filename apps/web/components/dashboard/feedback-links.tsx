"use client";

import { env } from "~/env";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

const FEATURE_REQUEST_HREF =
  "https://github.com/Jan-IngenHousz-Institute/open-jii/discussions/new?category=ideas";

const linkClassName = "text-primary hover:text-primary/80 font-semibold";

/** Where to report a problem or ask for something, under the home's last section. */
export function FeedbackLinks() {
  const { t } = useTranslation();

  return (
    <p className="text-muted-foreground text-sm">
      <Trans
        t={t}
        i18nKey="dashboard.feedback"
        components={{
          bug: (
            <a
              href={`${env.NEXT_PUBLIC_DOCS_URL}/guide/reference/getting-help`}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
            />
          ),
          feature: (
            <a
              href={FEATURE_REQUEST_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
            />
          ),
        }}
      />
    </p>
  );
}
