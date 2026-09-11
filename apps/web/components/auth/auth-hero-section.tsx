import Image from "next/image";

import initTranslations from "@repo/i18n/server";

interface AuthHeroSectionProps {
  locale: string;
}

// This sits on the auth pages' fixed black photo scrim (auth-background.tsx),
// which dims identically in both themes, so the foreground it pairs with is a
// fixed literal rather than a theme token. The nested text inherits it.
// eslint-disable-next-line no-restricted-syntax -- pairs with the auth photo scrim
const heroForeground = "text-white";

export async function AuthHeroSection({ locale }: AuthHeroSectionProps) {
  // Initialize translations
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div
      className={`hidden h-full w-full flex-col items-start justify-center md:flex ${heroForeground}`}
    >
      <h2 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
        {t("auth.heroTitle").split(" ").slice(0, 3).join(" ")} <br />{" "}
        {t("auth.heroTitle").split(" ").slice(3).join(" ")}
      </h2>
      <p className="mt-5 max-w-2xl text-lg sm:text-xl md:text-2xl">{t("auth.heroDescription")}</p>

      <div className="mt-10 flex items-center gap-3">
        <Image
          src="/openJII-logo-BW-horizontal-white.svg"
          alt="openJII Logo"
          width={160}
          height={80}
          className="h-12 w-auto"
          priority
        />
        <span className="-ml-1 text-sm sm:text-base">{t("auth.poweredBy")}</span>
        <Image
          src="/jan-ingenhousz-institute-logo-header-light.svg"
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
