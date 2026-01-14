import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { RegistrationForm } from "~/components/auth/registration-form";
import { TermsAndConditionsDialog } from "~/components/auth/terms-and-conditions-dialog";

import { Toaster } from "@repo/ui/components";

export default async function UserRegistrationPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParamsType;
}) {
  const session = await auth();
  const { locale } = await props.params;
  const { callbackUrl } = await props.searchParams;

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/register`);
  }

  if (session.user.registered) {
    redirect(`/${locale}/platform`);
  }

  // Fetch terms and conditions data
  const termsData = await TermsAndConditionsDialog({ locale });

  // pick random number between 1 and 4
  const bgIndex = Math.floor(Math.random() * 4) + 1;
  const bgImage = `/login-background-${bgIndex}.jpg`;

  return (
    <>
      {/* Navbar stays sticky on top */}
      <UnifiedNavbar locale={locale} session={session} />

      {/* Fixed full-screen background */}
      <div className="fixed inset-0 z-0 w-full">
        <Image src={bgImage} alt="Registration background" fill priority className="object-cover" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black/40" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-[calc(100vh-4rem)] w-full items-center">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid h-full grid-cols-1 md:grid-cols-2">
            {/* Registration Form */}
            <div className="flex flex-col p-0 md:px-10">
              <div className="w-full md:max-w-md">
                <RegistrationForm
                  callbackUrl={getFirstSearchParam(callbackUrl)}
                  termsData={termsData}
                />
              </div>
            </div>

            {/* Right Side Hero Text */}
            <AuthHeroSection locale={locale} />
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
}
