import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import type { SearchParamsType } from "@/util/searchParams";
import { MailCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { AuthBackground } from "~/components/auth/auth-background";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";

import initTranslations from "@repo/i18n/server";

export default async function VerifyRequestPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParamsType;
}) {
  const session = await auth();
  const { locale } = await props.params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const { provider } = await props.searchParams;
  if (!provider) {
    redirect(`/${locale}/`);
  }

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />

      <AuthBackground alt="Verify request background" />

      {/* Foreground content; see the note on the login page for `svh`. */}
      <div className="relative z-10 flex min-h-[calc(100svh-4rem)] w-full items-center px-4 py-8 sm:px-6 md:py-12">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            {/* Left side: Verify request card */}
            <div className="flex flex-col md:px-10">
              <div className="flex w-full flex-col justify-center">
                <div className="w-full max-w-none md:mx-0 md:max-w-md">
                  <div className="bg-card text-card-foreground flex w-full flex-col rounded-2xl p-5 shadow-2xl sm:p-6 md:p-10">
                    {/* Icon */}
                    <div className="mb-4 flex justify-center">
                      <span className="bg-primary/10 inline-flex items-center justify-center rounded-full p-3">
                        <MailCheck size={40} className="text-primary" />
                      </span>
                    </div>
                    {/* Title */}
                    <div className="mb-6 text-left">
                      <h1 className="text-3xl font-bold tracking-tight">
                        {t("auth.verifyRequest")}
                      </h1>
                    </div>

                    {/* Divider */}
                    <div className="mb-6 flex justify-center">
                      <div className="bg-primary/20 h-1 w-16 rounded-full" />
                    </div>

                    {/* Message content */}
                    <div className="space-y-6 text-left">
                      <p className="text-primary text-lg font-medium">
                        {t("auth.verifyRequestDetails")}
                      </p>
                      <p className="text-muted-foreground text-base">
                        {t("auth.verifyRequestDetailsJunk")}
                      </p>
                    </div>

                    <div className="flex-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Text content */}
            <AuthHeroSection locale={locale} />
          </div>
        </div>
      </div>
    </>
  );
}
