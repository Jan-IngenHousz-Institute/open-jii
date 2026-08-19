import type { Metadata } from "next";
import { MyInvitationsCard } from "~/components/account-settings/invitations/my-invitations-card";

import initTranslations from "@repo/i18n/server";

interface InvitationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: InvitationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["account"] });

  // The invitations are only readable by their recipient, so the title stays generic
  // rather than naming an organization to whoever the tab is open in front of.
  return { title: t("invitations.title") };
}

export default function InvitationsPage() {
  return <MyInvitationsCard />;
}
