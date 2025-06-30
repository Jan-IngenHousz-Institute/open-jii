import React from "react";

interface PoliciesContentProps {
  t: (key: string) => string;
}

export const PoliciesContent: React.FC<PoliciesContentProps> = ({ t }) => (
  <>
    <h1 className="text-jii-dark-green mb-8 text-center text-3xl font-bold">
      {t("policies.title")}
    </h1>
    <div className="prose prose-lg mx-auto text-gray-700">
      <p>{t("policies.content")}</p>
    </div>
  </>
);
