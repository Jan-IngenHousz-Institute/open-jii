import React from "react";

import { useTranslation } from "@repo/i18n";

export function BooleanAnswerDisplay() {
  const { t } = useTranslation(["experiments"]);

  return (
    <div className="rounded-lg bg-gradient-to-r from-green-50 to-green-100 p-6 text-center">
      <div className="mx-auto mb-3 w-fit rounded-full bg-white p-3 shadow-sm">
        <svg
          className="h-5 w-5 text-green-600"
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
      <p className="mb-1 font-medium text-gray-900">{t("questionCard.booleanResponseLabel")}</p>
      <p className="text-sm text-gray-600">{t("questionCard.booleanResponseDescription")}</p>
    </div>
  );
}
