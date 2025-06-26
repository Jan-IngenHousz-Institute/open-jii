import Link from "next/link";
import React from "react";

import { Container } from "@repo/cms/container";
import type { Locale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface NotFoundProps {
  params: Promise<{
    locale: Locale;
  }>;
}
export default async function NotFound({ params }: NotFoundProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale: locale });

  return (
    <Container>
      <title>{t("notFound.title")}</title>
      <h1 className="h2">{t("notFound.title")}</h1>
      <p className="mt-4">
        t({"notFound.description"})
        <Link className="text-blue500" href="/">
          t({"common.description"})
        </Link>
      </p>
    </Container>
  );
}
