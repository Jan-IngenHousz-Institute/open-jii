import { UnifiedNavbar } from "@/components/unified-navbar/unified-navbar";
import { auth } from "@/lib/auth";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { LoginForm } from "~/components/auth/login-form";

import type { Locale } from "@repo/i18n";

export default async function LoginPage(props: {
  params: Promise<{ locale: Locale }>;
  searchParams: SearchParamsType;
}) {
  const { locale } = await props.params;
  const { callbackUrl } = await props.searchParams;
  const session = await auth();

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
            {/* Left side: Login form */}
            <div className="flex flex-col p-0 md:mt-6 md:p-10">
              <div className="flex h-full w-full flex-col justify-center">
                <div className="w-full max-w-none md:mx-0 md:max-w-md">
                  <LoginForm callbackUrl={getFirstSearchParam(callbackUrl)} locale={locale} />
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
