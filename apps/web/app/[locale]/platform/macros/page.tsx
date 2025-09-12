import { ListMacros } from "@/components/list-macros";
import type { Metadata } from "next";
import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "Macros",
};

interface MacroPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function MacroPage({ params }: MacroPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">{t("macros.title")}</h1>
        <p>{t("macros.listDescription")}</p>
      </div>
      <Link href={`/platform/macros/new`} locale={locale}>
        <Button variant="outline">{t("macros.create")}</Button>
      </Link>
      <ListMacros />
    </div>
  );
}
