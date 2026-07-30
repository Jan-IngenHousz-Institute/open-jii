import { NewProtocolForm } from "@/components/new-protocol/new-protocol";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface NewProtocolPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewProtocolPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("protocols.newProtocol") };
}

export default function NewProtocolPage() {
  return (
    <PageContainer width="reading" className="space-y-6">
      <NewProtocolForm />
    </PageContainer>
  );
}
