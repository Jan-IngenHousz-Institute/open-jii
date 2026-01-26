import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { AuthHeroSection } from "~/components/auth/auth-hero-section";
import { ErrorContent } from "~/components/auth/error-content";

export default async function AuthErrorPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  const session = await auth();

  // Show 404 if error parameter is not present in URL at all
  if (!("error" in searchParams)) {
    notFound();
  }

  // Pick random background image
  const bgIndex = Math.floor(Math.random() * 4) + 1;
  const bgImage = `/login-background-${bgIndex}.jpg`;

  return (
    <>
      {/* Navbar stays sticky on top */}
      <UnifiedNavbar locale={locale} session={session} />

      {/* Fixed full-screen background */}
      <div className="fixed inset-0 z-0 w-full">
        <Image src={bgImage} alt="Error background" fill priority className="object-cover" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black/40" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-[calc(100vh-4rem)] w-full items-center">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid h-full grid-cols-1 md:grid-cols-2">
            {/* Error Content */}
            <div className="flex flex-col p-0 md:px-10">
              <div className="w-full md:max-w-md">
                <ErrorContent
                  locale={locale}
                  error={searchParams.error}
                  errorDescription={searchParams.error_description}
                />
              </div>
            </div>

            {/* Right Side Hero Text */}
            <AuthHeroSection locale={locale} />
          </div>
        </div>
      </div>
    </>
  );
}
