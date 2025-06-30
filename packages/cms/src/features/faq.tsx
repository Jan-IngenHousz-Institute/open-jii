import React from "react";

interface FaqContentProps {
  t: (key: string) => string;
}

export const FaqContent: React.FC<FaqContentProps> = ({ t }) => (
  <>
    <div className="mb-12 text-center">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">{t("faq.title")}</h1>
      <p className="mx-auto max-w-2xl text-lg text-gray-600">{t("faq.intro")}</p>
    </div>
    <div className="space-y-6">
      {[1, 2, 3, 4].map((idx) => (
        <div
          key={idx}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h3 className="mb-3 text-xl font-semibold text-gray-900">
            {t(`faq.question${idx}`)}
          </h3>
          <p className="leading-relaxed text-gray-700">{t(`faq.answer${idx}`)}</p>
        </div>
      ))}
    </div>
    <div className="mt-12 text-center">
      <p className="mb-4 text-gray-600">{t("faq.stillHaveQuestions")}</p>
      <a
        href="mailto:info@jii.org"
        className="bg-jii-dark-green hover:bg-jii-medium-green inline-block rounded-lg px-6 py-3 font-medium text-white transition-colors"
      >
        {t("faq.contactUs")}
      </a>
    </div>
  </>
);
