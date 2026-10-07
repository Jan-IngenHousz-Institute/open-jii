import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { MilestoneBanner } from "@/components/dashboard/milestone-banner";
import { PublicExperimentsSection } from "@/components/dashboard/public-experiments-section";
import { ResearchActivityPanel } from "@/components/dashboard/research-activity-panel";
import { UserExperimentsSection } from "@/components/dashboard/user-experiments-section";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import type { Metadata } from "next";
import { BlogPostsSection } from "~/components/dashboard/blog-posts-section";
import {
  publicExperimentsQuery,
  userExperimentsQuery,
} from "~/components/dashboard/dashboard-queries";
import { env } from "~/env";

import initTranslations from "@repo/i18n/server";

interface PlatformPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PlatformPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["dashboard"] });

  return { title: t("title") };
}

/** Renders the localized dashboard with personal experiments, public updates, and blog posts. */
export default async function PlatformDashboard({ params }: PlatformPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common", "dashboard"],
  });

  return (
    <PrefetchedQueries
      queries={(utils) => [userExperimentsQuery(utils), publicExperimentsQuery(utils)]}
    >
      <PageContainer width="fluid" className="space-y-6">
        {/* Dashboard Banner */}
        <DashboardBanner
          title={t("dashboard.transferBannerTitle")}
          description={t("dashboard.transferBannerDescription")}
          descriptionItalic={t("dashboard.transferBannerDescriptionItalic")}
          descriptionItalicHref={
            "https://github.com/Jan-IngenHousz-Institute/open-jii/discussions/new?category=ideas"
          }
          secondaryButtonLabel={t("dashboard.reportBugButton")}
          secondaryButtonHref={`${env.NEXT_PUBLIC_DOCS_URL}/guide/reference/getting-help`}
          buttonLabel={t("dashboard.transferBannerButton")}
          buttonHref={`/${locale}/platform/transfer-request`}
          locale={locale}
        />

        {/* Milestone Moment */}
        <MilestoneBanner locale={locale} />

        {/* Platform Pulse */}
        <ResearchActivityPanel locale={locale} />

        {/* First Row - User's Experiments */}
        <DashboardSection
          title={t("dashboard.yourExperiments")}
          seeAllLabel={t("dashboard.seeAll")}
          seeAllHref="/platform/experiments"
          locale={locale}
        >
          <UserExperimentsSection />
        </DashboardSection>

        {/* Recently updated public experiments */}
        <DashboardSection
          title={t("dashboard.recentPublicExperiments")}
          seeAllLabel={t("dashboard.seeAll")}
          seeAllHref="/platform/experiments?visibility=public"
          locale={locale}
        >
          <PublicExperimentsSection />
        </DashboardSection>

        {/* Recent Blog Posts */}
        <DashboardSection
          title={t("dashboard.recentArticles")}
          seeAllLabel={t("dashboard.seeAll")}
          seeAllHref="/blog"
          locale={locale}
        >
          <BlogPostsSection locale={locale} />
        </DashboardSection>
      </PageContainer>
    </PrefetchedQueries>
  );
}
