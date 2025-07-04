import { NewProtocolForm } from "@/components/new-protocol";
import type { Metadata } from "next";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "New Protocol",
};

interface NewProtocolPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function NewProtocolPage({ params }: NewProtocolPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("protocols.newProtocol")}</h3>
        <p className="text-muted-foreground text-sm">{t("newProtocol.description")}</p>
      </div>
      <NewProtocolForm />
    </div>
  );
}
