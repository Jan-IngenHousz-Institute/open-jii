import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Container } from "@repo/cms/container";
import initTranslations from "@repo/i18n/server";

export default async function ReleaseNotFound() {
  // notFound() doesn't forward route params, so default to en-US (same limitation as the blog
  // not-found page).
  const { t } = await initTranslations({ locale: "en-US", namespaces: ["navigation"] });

  return (
    <Container className="py-20">
      <title>{t("releases.notFoundTitle")}</title>
      <h1 className="text-2xl font-semibold">{t("releases.notFoundTitle")}</h1>
      <p className="text-muted-foreground mt-4">{t("releases.notFoundDescription")}</p>
      <Link
        href="/releases"
        className="text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("releases.backToReleases")}
      </Link>
    </Container>
  );
}
