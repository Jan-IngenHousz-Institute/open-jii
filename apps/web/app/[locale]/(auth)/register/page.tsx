import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import { redirect } from "next/navigation";
import z from "zod";
import { auth } from "~/app/actions/auth";
import { AuthBackground } from "~/components/auth/auth-background";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { RegistrationForm } from "~/components/auth/registration-form";
import { TermsAndConditionsDialog } from "~/components/auth/terms-and-conditions-dialog";

import { Toaster } from "@repo/ui/components/toaster";

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

  const hasValidEmail = z.string().email().safeParse(session.user.email).success;

  if (session.user.registered && hasValidEmail) {
    redirect(`/${locale}/platform`);
  }

  // Users with invalid emails that are already registered also have emailVerified = true
  const emailOnly = session.user.emailVerified === true && !hasValidEmail;

  // Fetch terms and conditions data
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <>
      {/* Navbar stays sticky on top */}
      <UnifiedNavbar locale={locale} session={session} />

      <AuthBackground alt="Registration background" />

      {/* Foreground content; see the note on the login page for `svh`. */}
      <div className="relative z-10 flex min-h-[calc(100svh-4rem)] w-full items-center px-4 py-8 sm:px-6 md:py-12">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            {/* Registration Form */}
            <div className="flex flex-col md:px-10">
              <div className="w-full md:max-w-md">
                <RegistrationForm
                  callbackUrl={getFirstSearchParam(callbackUrl)}
                  termsData={termsData}
                  userEmail={session.user.email}
                  emailOnly={emailOnly}
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
