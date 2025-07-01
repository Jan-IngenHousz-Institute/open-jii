import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { FaqContent } from "@repo/cms";
import type { PageFaqFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface FaqPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const faqQuery = await gqlClient.pageFaq({ locale, preview });
  const faq = faqQuery.pageFaqCollection?.items[0] as PageFaqFieldsFragment;

  return (
    <main className="min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4">
        <FaqContent
          translations={{
            title: t("faq.title"),
            intro: t("faq.intro"),
          }}
          faq={faq}
          locale={locale}
          preview={preview}
        />
      </div>
    </main>
  );
}
