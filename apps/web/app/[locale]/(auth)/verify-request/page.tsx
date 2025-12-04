import { UnifiedNavbar } from "@/components/unified-navbar/unified-navbar";
import { auth } from "@/lib/auth";
import type { SearchParamsType } from "@/util/searchParams";
import { MailCheck } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
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

  // pick random number between 1 and 4
  const bgIndex = Math.floor(Math.random() * 4) + 1;
  const bgImage = `/login-background-${bgIndex}.jpg`;

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />

      {/* Fixed full-screen background */}
      <div className="fixed inset-0 z-0 w-full">
        <Image
          src={bgImage}
          alt="Verify request background"
          fill
          priority
          className="object-cover"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black/40" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-[calc(100vh-4rem)] w-full items-center">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid h-full grid-cols-1 md:grid-cols-2">
            {/* Left side: Verify request card */}
            <div className="flex flex-col p-0 md:p-10">
              <div className="flex h-full w-full flex-col justify-center">
                <div className="w-full max-w-none md:mx-0 md:max-w-md">
                  <div className="bg-card text-card-foreground ring-border flex h-full min-h-[420px] w-full flex-col rounded-2xl p-6 shadow-lg ring-1 md:min-h-[600px] lg:p-14">
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
