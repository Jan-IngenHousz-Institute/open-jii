import { UnifiedNavbar } from "@/components/unified-navbar/unified-navbar";
import { auth } from "@/lib/auth";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import Image from "next/image";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { LoginForm } from "~/components/auth/login-form";

export default async function LoginPage(props: {
  params: Promise<{ locale: string }>;
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
      <div className="relative min-h-svh w-full overflow-hidden">
        {/* Background Image */}
        <Image src={bgImage} alt="Login background" fill priority className="object-cover" />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-l from-black via-black/80 to-black/40" />

        {/* Content */}
        <div className="relative z-20 mx-auto max-w-7xl">
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
