import { ListExperiments } from "@/components/list-experiments";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "Experiments",
};

interface ExperimentPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const session = await auth();
  const userId = session?.user.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">{t("experiments.title")}</h1>
        <p>{t("experiments.listDescription")}</p>
      </div>
      <Link href={`/platform/experiments/new`} locale={locale}>
        <Button variant="outline">{t("experiments.create")}</Button>
      </Link>
      <ListExperiments userId={userId ?? ""} />
    </div>
  );
}
