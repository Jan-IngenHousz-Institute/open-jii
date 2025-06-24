"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Container } from "@repo/cms/container";
import type { Locale } from "@repo/i18n";

export const Header = ({ locale }: { locale: string }) => {
  const { t } = useTranslation();

  return (
    <header className="py-5">
      <nav>
        <Container className="flex items-center justify-between">
          <Link
            href={`/${locale}/blog`}
            className="mr-8 text-4xl font-medium tracking-tight text-gray-900"
            title="Blog"
          >
            Blog
          </Link>
          <Link href="/" title={t("common.homepage")}></Link>
          <LanguageSwitcher locale={locale as Locale} />
        </Container>
      </nav>
    </header>
  );
};
