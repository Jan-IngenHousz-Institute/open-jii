import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { UserExperimentsSection } from "@/components/dashboard/user-experiments-section";
import type { Metadata } from "next";
import { BlogPostsSection } from "~/components/dashboard/blog-posts-section";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

export const metadata: Metadata = {
  title: "Dashboard - openJII",
};

interface PlatformPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function PlatformDashboard({ params }: PlatformPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <h1 className="text-3xl font-bold text-gray-900">{t("dashboard.title")}</h1>

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
