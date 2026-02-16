import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { auth } from "~/app/actions/auth";
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
  LandingMetadataFieldsFragment,
} from "@repo/cms/lib/__generated/sdk";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

const getHomeData = cache(async (locale: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const homeData = await gqlClient.pageHome({ locale, preview });
  return {
    hero: homeData.pageHomeHeroCollection?.items[0] as PageHomeHeroFieldsFragment,
    mission: homeData.pageHomeMissionCollection?.items[0] as PageHomeMissionFieldsFragment,
    features: homeData.pageHomeFeaturesCollection?.items[0] as PageHomeFeaturesFieldsFragment,
    partners: homeData.pageHomePartnersCollection?.items[0] as PageHomePartnersFieldsFragment,
    footer: homeData.footerCollection?.items[0] as FooterFieldsFragment,
    landingMetadata: homeData.landingMetadataCollection?.items[0] as LandingMetadataFieldsFragment,
  };
});

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const { landingMetadata } = await getHomeData(locale, preview);

  const metadata: Metadata = {};

  if (landingMetadata.title) {
    metadata.title = landingMetadata.title;
  }

  if (landingMetadata.description) {
    metadata.description = landingMetadata.description;
  }

  return metadata;
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  const session = await auth();
  const { isEnabled: preview } = await draftMode();
  const { hero, mission, features, partners, footer } = await getHomeData(locale, preview);

  return (
    <>
      <UnifiedNavbar locale={locale} session={session} isHomePage={true} />
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-br">
        {/* Hero Section */}
        <HomeHeroComponent heroData={hero} preview={preview} locale={locale} />

        {/* Partners Section */}
        <HomePartners partnersData={partners} preview={preview} locale={locale} />

        {/* About & Mission Section */}
        <HomeAboutMission missionData={mission} preview={preview} locale={locale} />

        {/* Features Section */}
        <HomeKeyFeatures featuresData={features} preview={preview} locale={locale} />

        {/* Footer */}
        <HomeFooter locale={locale} footerData={footer} preview={preview} />
      </main>
    </>
  );
}
