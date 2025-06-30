import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import { ChevronDown } from "lucide-react";

import { HomeHero, HomeAboutMission, HomeKeyFeatures, HomePartners, HomeFooter } from "@repo/cms";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  const session = await auth();
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
        {/* Animated Background Elements */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
          <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-pulse rounded-full bg-gradient-to-r from-emerald-400/20 to-blue-400/20 blur-3xl"></div>
          <div
            className="absolute bottom-1/4 right-1/4 h-80 w-80 animate-pulse rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-3xl"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        {/* Hero Section */}
        <HomeHero t={t} />

        {/* Scroll Indicator */}
        <div className="animate-bounce">
          <ChevronDown className="mx-auto h-8 w-8 text-emerald-500" />
        </div>

        {/* About & Mission Section */}
        <HomeAboutMission t={t} />

        {/* Enhanced Key Features */}
        <HomeKeyFeatures t={t} />

        {/* Enhanced Partner Highlights & Visual Media */}
        <HomePartners t={t} />

        {/* Enhanced Footer */}
        <HomeFooter t={t} locale={locale} />
      </main>
    </>
  );
}
