import React from "react";

import { useTranslation } from "@repo/i18n";

export function NumberAnswerDisplay() {
  const { t } = useTranslation(["experiments"]);

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 p-6 text-center">
      <div className="mx-auto mb-3 w-fit rounded-full bg-white p-3 shadow-sm">
        <svg
          className="h-5 w-5 text-blue-600"
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
      <p className="mb-1 font-medium text-gray-900">{t("questionCard.numberResponseLabel")}</p>
      <p className="text-sm text-gray-600">{t("questionCard.numberResponseDescription")}</p>
    </div>
  );
}
