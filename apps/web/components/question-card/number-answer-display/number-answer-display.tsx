import React from "react";

import { useTranslation } from "@repo/i18n";

export function NumberAnswerDisplay() {
  const { t } = useTranslation(["experiments"]);

  return (
    <div className="bg-status-published rounded-lg p-6 text-center">
      <div className="shadow-xs bg-card mx-auto mb-3 w-fit rounded-full p-3">
        <svg
          className="text-status-published-foreground h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
          />
        </svg>
      </div>
      <p className="text-foreground mb-1 font-medium">{t("questionCard.numberResponseLabel")}</p>
      <p className="text-muted-foreground text-sm">{t("questionCard.numberResponseDescription")}</p>
    </div>
  );
}
