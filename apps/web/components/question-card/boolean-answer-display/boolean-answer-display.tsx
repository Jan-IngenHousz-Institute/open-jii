import React from "react";

import { useTranslation } from "@repo/i18n";

export function BooleanAnswerDisplay() {
  const { t } = useTranslation(["experiments"]);

  return (
    <div className="bg-status-active rounded-lg p-6 text-center">
      <div className="shadow-xs bg-card mx-auto mb-3 w-fit rounded-full p-3">
        <svg
          className="text-status-active-foreground h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-foreground mb-1 font-medium">{t("questionCard.booleanResponseLabel")}</p>
      <p className="text-muted-foreground text-sm">
        {t("questionCard.booleanResponseDescription")}
      </p>
    </div>
  );
}
