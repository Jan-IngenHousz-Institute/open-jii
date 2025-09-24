import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { TermsAndConditionsContent, TermsAndConditionsTitle } from "@repo/cms";
import type { PageTermsAndConditionsFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface TermsAndConditionsDialogProps {
  locale: Locale;
}

export async function TermsAndConditionsDialog({ locale }: TermsAndConditionsDialogProps) {
  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  // Initialize translations for fallback content
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  try {
    const termsQuery = await gqlClient.pageTermsAndConditions({ locale, preview });
    const termsAndConditions = termsQuery.pageTermsAndConditionsCollection
      ?.items[0] as PageTermsAndConditionsFieldsFragment;

    return {
      title: (
        <TermsAndConditionsTitle
          termsAndConditions={termsAndConditions}
          locale={locale}
          preview={preview}
        />
      ),
      content: (
        <TermsAndConditionsContent
          termsAndConditions={termsAndConditions}
          locale={locale}
          preview={preview}
        />
      ),
    };
  } catch {
    return {
      title: t("registration.termsAndConditions"),
      content: (
        <div className="text-muted-foreground space-y-2 text-sm">
          <p>{t("errors.termsUnavailable")}</p>
        </div>
      ),
    };
  }
}
