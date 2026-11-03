"use client";

import Link from "next/link";

import { useTranslation } from "@repo/i18n/client";

export default function NotFound() {
  const { t } = useTranslation("status");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <Link href="/" className="text-primary font-medium underline underline-offset-4">
        {t("notFound.home")}
      </Link>
    </main>
  );
}
