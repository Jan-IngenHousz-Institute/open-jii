import React from "react";

import { useTranslation } from "@repo/i18n";

export function TextAnswerDisplay() {
  const { t } = useTranslation(["experiments"]);

  return (
    <div className="bg-accent rounded-lg p-6 text-center">
      <div className="shadow-xs bg-card mx-auto mb-3 w-fit rounded-full p-3">
        <svg className="text-primary h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </div>
      <p className="text-foreground mb-1 font-medium">{t("questionCard.textResponseLabel")}</p>
      <p className="text-muted-foreground text-sm">{t("questionCard.textResponseDescription")}</p>
    </div>
  );
}
