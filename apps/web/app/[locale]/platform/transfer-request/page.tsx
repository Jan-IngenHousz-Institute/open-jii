import type { Metadata } from "next";
import { DocsHelpLink } from "~/components/docs-help-link";
import { TransferRequestForm } from "~/components/transfer-request-form";

import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "Request Project Transfer",
};

interface TransferRequestPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TransferRequestPage({ params }: TransferRequestPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-8">
      <div className="bg-surface-light rounded-xl border p-4">
        <h2 className="mb-2 font-medium">{t("transferRequest.importantNote")}</h2>
        <ul className="text-muted-foreground list-outside list-disc space-y-1 pl-3 text-sm">
          <li>{t("transferRequest.note1")}</li>
          <li>{t("transferRequest.note2")}</li>
          <li>{t("transferRequest.note3")}</li>
        </ul>
        <div className="mt-3">
          <DocsHelpLink path="/guide/sharing/project-transfers" />
        </div>
      </div>

      <TransferRequestForm />
    </div>
  );
}
