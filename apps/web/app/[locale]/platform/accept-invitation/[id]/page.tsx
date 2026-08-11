import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import AcceptInvitationContent from "./accept-invitation-content";

interface AcceptInvitationPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: AcceptInvitationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  // The invitation is only readable by its recipient, so the title stays generic
  // rather than naming an organization to whoever opens the link.
  return { title: t("organizations.acceptInvitation.pageTitle") };
}

export default function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  return <AcceptInvitationContent params={params} />;
}
