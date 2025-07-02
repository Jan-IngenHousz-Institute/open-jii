import { UnifiedNavbar } from "@/components/unified-navbar";
import { auth } from "@/lib/auth";
import { ChevronDown } from "lucide-react";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import {
  HomeHero as HomeHeroComponent,
  HomeAboutMission,
  HomeKeyFeatures,
  HomePartners,
  HomeFooter,
} from "@repo/cms";
import type {
  PageHomeMissionFieldsFragment,
  PageHomeHeroFieldsFragment,
  PageHomeFeaturesFieldsFragment,
  PageHomePartnersFieldsFragment,
} from "@repo/cms/lib/__generated/sdk";
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

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  // Fetch hero, mission, features, and partners data from Contentful
  const [homeHeroQuery, homeMissionQuery, homeFeaturesQuery, homePartnersQuery] = await Promise.all(
    [
      gqlClient.pageHomeHero({ locale, preview }),
      gqlClient.pageHomeMission({ locale, preview }),
      gqlClient.pageHomeFeatures({ locale, preview }),
      gqlClient.pageHomePartners({ locale, preview }),
    ],
  );
  const homeHero = homeHeroQuery.pageHomeHeroCollection?.items[0] as PageHomeHeroFieldsFragment;
  const homeMission = homeMissionQuery.pageHomeMissionCollection
    ?.items[0] as PageHomeMissionFieldsFragment;
  const homeFeatures = homeFeaturesQuery.pageHomeFeaturesCollection
    ?.items[0] as PageHomeFeaturesFieldsFragment;
  const homePartners = homePartnersQuery.pageHomePartnersCollection
    ?.items[0] as PageHomePartnersFieldsFragment;

  // Prepare translations for client component
  const translations = {
    institute: t("jii.institute"),
    aboutDescription: t("jii.aboutDescription"),
    mission: t("jii.mission"),
    missionDescription: t("jii.missionDescription"),
  };

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

        {/* Hero Section - now uses Contentful data */}
        <HomeHeroComponent heroData={homeHero} preview={preview} />

        {/* Scroll Indicator */}
        <div className="animate-bounce">
          <ChevronDown className="mx-auto h-8 w-8 text-emerald-500" />
        </div>

        {/* About & Mission Section - now uses Contentful data */}
        <HomeAboutMission translations={translations} missionData={homeMission} preview={preview} />

        {/* Enhanced Key Features */}
        <HomeKeyFeatures featuresData={homeFeatures} preview={preview} />

        {/* Enhanced Partner Highlights & Visual Media */}
        <HomePartners partnersData={homePartners} preview={preview} />

        {/* Enhanced Footer */}
        <HomeFooter t={t} locale={locale} />
      </main>
    </>
  );
}
