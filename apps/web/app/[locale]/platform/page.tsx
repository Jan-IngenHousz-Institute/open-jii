import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { UserExperimentsSection } from "@/components/dashboard/user-experiments-section";
import type { Metadata } from "next";
import { BlogPostsSection } from "~/components/dashboard/blog-posts-section";
import { env } from "~/env";

import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "Dashboard - openJII",
};

interface PlatformPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PlatformDashboard({ params }: PlatformPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common", "dashboard"],
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Banner */}
      <div className="mt-6">
        <DashboardBanner
          title={t("dashboard.transferBannerTitle")}
          description={t("dashboard.transferBannerDescription")}
          descriptionItalic={t("dashboard.transferBannerDescriptionItalic")}
          descriptionItalicHref={`https://github.com/Jan-IngenHousz-Institute/open-jii/discussions/new?category=ideas`}
          secondaryButtonLabel={t("dashboard.reportBugButton")}
          secondaryButtonHref={`${env.NEXT_PUBLIC_DOCS_URL}/docs/data-platform/report-issue`}
          buttonLabel={t("dashboard.transferBannerButton")}
          buttonHref={`/${locale}/platform/transfer-request`}
          locale={locale}
        />
      </div>

      {/* Dashboard Header */}
      <h1 className="text-4xl font-bold text-gray-900">{t("dashboard.title")}</h1>

      {/* First Row - User's Experiments */}
      <DashboardSection
        title={t("dashboard.yourExperiments")}
        seeAllLabel={t("dashboard.seeAll")}
        seeAllHref="/platform/experiments?filter=all"
        locale={locale}
      >
        <UserExperimentsSection />
      </DashboardSection>

      {/* Second Row - Recent Blog Posts */}
      <DashboardSection
        title={t("dashboard.recentArticles")}
        seeAllLabel={t("dashboard.seeAll")}
        seeAllHref="/blog"
        locale={locale}
      >
        <BlogPostsSection locale={locale} />
      </DashboardSection>
    </div>
  );
}
