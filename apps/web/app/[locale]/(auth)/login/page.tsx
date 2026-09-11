import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import { auth } from "~/app/actions/auth";
import { AuthBackground } from "~/components/auth/auth-background";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { LoginForm } from "~/components/auth/login-form";
import { TermsAndConditionsDialog } from "~/components/auth/terms-and-conditions-dialog";

import { Toaster } from "@repo/ui/components/toaster";

export default async function LoginPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParamsType;
}) {
  const { locale } = await props.params;
  const { callbackUrl } = await props.searchParams;
  const session = await auth();

  // Fetch terms data on the server
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <>
      {/* Navbar stays sticky on top */}
      <UnifiedNavbar locale={locale} session={session} />

      <AuthBackground alt="Login background" />

      {/* Foreground content. `svh` and a min height, not `vh` and a fixed one:
          mobile browser chrome makes 100vh taller than the visible viewport. */}
      <div className="relative z-10 flex min-h-[calc(100svh-4rem)] w-full items-center px-4 py-8 sm:px-6 md:py-12">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            {/* Login Form */}
            <div className="flex flex-col md:px-10">
              <div className="w-full md:max-w-md">
                <LoginForm
                  callbackUrl={getFirstSearchParam(callbackUrl)}
                  locale={locale}
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
