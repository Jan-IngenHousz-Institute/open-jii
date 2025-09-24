import Image from "next/image";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface AuthHeroSectionProps {
  locale: Locale;
}

export async function AuthHeroSection({ locale }: AuthHeroSectionProps) {
  // Initialize translations
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="hidden h-full w-full flex-col items-start justify-center text-white md:flex">
      <h2 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
        {t("auth.heroTitle").split(" ").slice(0, 3).join(" ")} <br />{" "}
        {t("auth.heroTitle").split(" ").slice(3).join(" ")}
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-white/80 sm:text-xl md:text-2xl">
        {t("auth.heroDescription")}
      </p>

      <div className="mt-10 flex items-center space-x-3 text-white/70">
        <span className="text-base font-semibold sm:text-lg">{t("auth.brandName")}</span>
        <span className="text-sm sm:text-base">{t("auth.poweredBy")}</span>
        <Image
          src="/jan-ingenhousz-institute-logo-header-light.png"
          alt={t("auth.instituteAlt")}
          width={140}
          height={28}
          className="h-6 w-auto"
          priority
        />
      </div>
    </div>
  );
}
