import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardFeed } from "@/components/dashboard/dashboard-feed";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
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
      <div className="-mt-6">
        <DashboardBanner
          title={t("dashboard.transferBannerTitle")}
          description={t("dashboard.transferBannerDescription")}
          descriptionItalic={t("dashboard.transferBannerDescriptionItalic")}
          descriptionItalicHref={
            "https://github.com/Jan-IngenHousz-Institute/open-jii/discussions/new?category=ideas"
          }
          secondaryButtonLabel={t("dashboard.reportBugButton")}
          secondaryButtonHref={`${env.NEXT_PUBLIC_DOCS_URL}/docs/data-platform/report-issue`}
          buttonLabel={t("dashboard.transferBannerButton")}
          buttonHref={`/${locale}/platform/transfer-request`}
          locale={locale}
        />
      </div>

      {/* Dashboard Header */}
      <h1 className="text-4xl font-bold text-gray-900">{t("dashboard.title")}</h1>

      {/* First Row - Personal activity feed */}
      <section className="flex flex-col">
        <h2 className="mb-4 text-[1rem] font-bold leading-[1.3125rem] text-[#011111]">
          {t("dashboard.feedTitle")}
        </h2>
        <DashboardFeed />
      </section>

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
