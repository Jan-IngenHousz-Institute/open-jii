import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { zJoinCodeValue } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import initTranslations from "@repo/i18n/server";

import { JoinLandingContent } from "./join-landing-content";

interface JoinLandingPageProps {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({ params }: JoinLandingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("joinLanding.title") };
}

export default async function JoinLandingPage({ params }: JoinLandingPageProps) {
  const { code } = await params;
  const parsed = zJoinCodeValue.safeParse(code);

  if (!parsed.success) {
    return notFound();
  }

  return <JoinLandingContent code={parsed.data} />;
}
