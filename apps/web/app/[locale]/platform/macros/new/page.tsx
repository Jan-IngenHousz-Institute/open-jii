import { NewMacroForm } from "@/components/new-macro/new-macro";
import type { Metadata } from "next";
import React from "react";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "New Macro",
};

interface NewMacroPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function NewMacroPage({ params }: NewMacroPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["macro"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("macros.newMacro")}</h3>
        <p className="text-muted-foreground text-sm">{t("newMacro.description")}</p>
      </div>
      <NewMacroForm />
    </div>
  );
}
