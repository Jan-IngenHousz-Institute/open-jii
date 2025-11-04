import { UnifiedNavbar } from "@/components/unified-navbar/unified-navbar";
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
  FooterFieldsFragment,
} from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  const session = await auth();

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  // Fetch hero, mission, features, partners, and footer data from Contentful
  // Fetch all home page content from Contentful
  const contentQueries = await Promise.all([
    gqlClient.pageHomeHero({ locale, preview }),
    gqlClient.pageHomeMission({ locale, preview }),
    gqlClient.pageHomeFeatures({ locale, preview }),
    gqlClient.pageHomePartners({ locale, preview }),
    gqlClient.footer({ locale, preview }),
  ]);

  // Extract and type the content data
  const [homeHero, homeMission, homeFeatures, homePartners, footerData] = [
    contentQueries[0].pageHomeHeroCollection?.items[0] as PageHomeHeroFieldsFragment,
    contentQueries[1].pageHomeMissionCollection?.items[0] as PageHomeMissionFieldsFragment,
    contentQueries[2].pageHomeFeaturesCollection?.items[0] as PageHomeFeaturesFieldsFragment,
    contentQueries[3].pageHomePartnersCollection?.items[0] as PageHomePartnersFieldsFragment,
    contentQueries[4].footerCollection?.items[0] as FooterFieldsFragment,
  ];

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} />
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
        {/* Hero Section */}
        <HomeHeroComponent heroData={homeHero} preview={preview} locale={locale} />

        {/* Scroll Indicator */}
        <div className="animate-bounce">
          <ChevronDown className="mx-auto h-8 w-8 text-emerald-500" />
        </div>

        {/* About & Mission Section */}
        <HomeAboutMission missionData={homeMission} preview={preview} locale={locale} />

        {/* Enhanced Key Features */}
        <HomeKeyFeatures featuresData={homeFeatures} preview={preview} locale={locale} />

        {/*Partner & Visual Media */}
        <HomePartners partnersData={homePartners} preview={preview} locale={locale} />

        {/* Footer */}
        <HomeFooter locale={locale} footerData={footerData} preview={preview} />
      </main>
    </>
  );
}
