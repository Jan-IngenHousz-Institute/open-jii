import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import TransferRequestHistoryClient from "./transfer-request-history-client";

interface TransferRequestHistoryPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: TransferRequestHistoryPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("transferRequest.yourRequests") };
}

export default function TransferRequestHistoryPage() {
  return <TransferRequestHistoryClient />;
}
