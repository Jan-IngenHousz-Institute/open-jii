import { RegistrationForm } from "@/components/registration-form";
import { TermsAndConditionsDialog } from "@/components/terms-and-conditions-dialog";
import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import Image from "next/image";
import { redirect } from "next/navigation";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Toaster } from "@repo/ui/components";

export default async function UserRegistrationPage(props: {
  params: Promise<{ locale: Locale }>;
  searchParams: SearchParamsType;
}) {
  const session = await auth();
  const { locale } = await props.params;
  const { callbackUrl } = await props.searchParams;

  if (!session?.user) {
    redirect(`/api/auth/signin`);
  }

  if (session.user.registered) {
    redirect(`/${locale}/platform`);
  }

  // Initialize translations
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  // Fetch terms and conditions data
  const termsData = await TermsAndConditionsDialog({ locale });

  // pick random number between 1 and 4
  const bgIndex = Math.floor(Math.random() * 4) + 1;
  const bgImage = `/login-background-${bgIndex}.jpg`;

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <div
        className="relative min-h-svh w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0.8), rgba(0,0,0,0.4)), url('${bgImage}')`,
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid min-h-svh w-full grid-cols-1 md:grid-cols-2">
            {/* Left side: Registration form */}
            <div className="flex flex-col p-0 md:mt-6 md:p-10">
              <div className="flex h-full w-full flex-col justify-center">
                <div className="w-full max-w-none md:mx-0 md:max-w-md">
                  <RegistrationForm
                    callbackUrl={getFirstSearchParam(callbackUrl)}
                    termsData={termsData}
                  />
                </div>
              </div>
            </div>

            {/* Right side: Text content */}
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
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
}
