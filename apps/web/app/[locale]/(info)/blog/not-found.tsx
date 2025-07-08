import Link from "next/link";
import React from "react";

import { Container } from "@repo/cms/container";
import initTranslations from "@repo/i18n/server";

export default async function NotFound() {
  // TODO: Needs to get locale from params, but because of how notFound works, we don't actually get the params when the user is redirected here.
  // const { locale } = await params;
  const { t } = await initTranslations({ locale: "en-US" });

  return (
    <Container>
      <title>{t("notFound.title")}</title>
      <h1 className="h2">{t("notFound.title")}</h1>
      <p className="mt-4">
        {t("notFound.description")}
        <Link className="text-blue500" href="/">
          {t("common.description")}
        </Link>
      </p>
    </Container>
  );
}
