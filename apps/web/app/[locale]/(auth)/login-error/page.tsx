import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import { notFound } from "next/navigation";
import { auth } from "~/app/actions/auth";
import { AuthBackground } from "~/components/auth/auth-background";
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

  return (
    <>
      {/* Navbar stays sticky on top */}
      <UnifiedNavbar locale={locale} session={session} />

      <AuthBackground alt="Error background" />

      {/* Foreground content; see the note on the login page for `svh`. */}
      <div className="relative z-10 flex min-h-[calc(100svh-4rem)] w-full items-center px-4 py-8 sm:px-6 md:py-12">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            {/* Error Content */}
            <div className="flex flex-col md:px-10">
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
