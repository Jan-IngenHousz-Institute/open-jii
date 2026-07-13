import { ListCommands } from "@/components/list-commands";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";
import Link from "next/link";

import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components/button";

export const metadata: Metadata = {
  title: "Commands",
};

interface CommandPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CommandPage({ params }: CommandPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <PageContainer width="fluid" className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("commands.title")}</h1>
          <p>{t("commands.listDescription")}</p>
        </div>
        <Link href={`/platform/commands/new`} locale={locale}>
          <Button>{t("commands.create")}</Button>
        </Link>
      </div>
      <ListCommands />
    </PageContainer>
  );
}
