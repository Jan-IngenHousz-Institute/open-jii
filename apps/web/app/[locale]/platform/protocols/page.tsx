import { ListProtocols } from "@/components/list-protocols";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@repo/auth/next";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "Protocols",
};

interface ProtocolPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ProtocolPage({ params }: ProtocolPageProps) {
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
        <h1 className="text-lg font-medium">{t("protocols.title")}</h1>
        <p>{t("protocols.listDescription")}</p>
      </div>
      <Link href={`/platform/protocols/new`} locale={locale}>
        <Button variant="outline">{t("protocols.create")}</Button>
      </Link>
      <ListProtocols userId={userId ?? ""} />
    </div>
  );
}
