import { draftMode } from "next/headers";
import { getTermsAndConditions } from "~/components/cms/fetch-terms-and-conditions";
import {
  TermsAndConditionsContent,
  TermsAndConditionsTitle,
} from "~/components/cms/terms-and-conditions";

import type { PageTermsAndConditionsFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import initTranslations from "@repo/i18n/server";

interface TermsAndConditionsDialogProps {
  locale: string;
}

export async function TermsAndConditionsDialog({ locale }: TermsAndConditionsDialogProps) {
  const { isEnabled: preview } = await draftMode();

  // Initialize translations for fallback content
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  try {
    const termsQuery = await getTermsAndConditions(locale, preview);
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
