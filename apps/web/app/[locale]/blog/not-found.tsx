import { headers } from "next/headers";
import Link from "next/link";
import React from "react";
import { Trans as TransComponent } from "react-i18next/TransWithoutContext";

import { Container } from "@repo/cms/container";
import type { Locale } from "@repo/i18n/config";
import { defaultLocale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

const Trans = TransComponent as React.ComponentType<{
  i18nKey: string;
  t: (key: string) => string;
  children?: React.ReactNode;
}>;

export default async function NotFound() {
  const headersList = headers();
  const locale = (await headersList).get("x-next-i18n-router-locale") ?? defaultLocale;
  const { t } = await initTranslations({ locale: locale as Locale });

  return (
    <Container>
      <title>{t("notFound.title")}</title>
      <h1 className="h2">{t("notFound.title")}</h1>
      <p className="mt-4">
        <Trans i18nKey="notFound.description" t={t}>
          <Link className="text-blue500" href="/">
            homepage
          </Link>
        </Trans>
      </p>
    </Container>
  );
}
