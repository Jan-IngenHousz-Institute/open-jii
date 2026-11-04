import type { Metadata } from "next";
import { notFound } from "next/navigation";

import initTranslations from "@repo/i18n/server";

import { UnsubscribeContent } from "./unsubscribe-content";

interface UnsubscribePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: Pick<UnsubscribePageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["notifications"] });

  return { title: t("unsubscribe.title") };
}

export default async function UnsubscribePage({ params, searchParams }: UnsubscribePageProps) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);

  if (typeof token !== "string" || token.length === 0) {
    return notFound();
  }

  return <UnsubscribeContent token={token} locale={locale} />;
}
