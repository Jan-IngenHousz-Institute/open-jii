"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

interface AnalysisLayoutProps {
  children: React.ReactNode;
}

export default function AnalysisLayout({ children }: AnalysisLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { t } = useTranslation("experiments");

  // Determine active tab from URL. Dashboards is the headline tab now;
  // Visualizations stays for users who want a single chart at a time.
  const getActiveTab = () => {
    if (pathname.includes("/dashboards")) return "dashboards";
    if (pathname.includes("/visualizations")) return "visualizations";
    if (pathname.includes("/notebooks")) return "notebooks";
    return "dashboards";
  };

  // Hide the sub-tab bar on detail/edit pages so they get the full canvas.
  // Only the main list pages keep the tabs.
  const shouldShowAnalysisLayout = () => {
    return (
      pathname === `/${locale}/platform/experiments/${id}/analysis/dashboards` ||
      pathname === `/${locale}/platform/experiments/${id}/analysis/visualizations` ||
      pathname === `/${locale}/platform/experiments/${id}/analysis/notebooks`
    );
  };

  const activeTab = getActiveTab();

  // If it's a sub-page (new, edit, detail), just render children without layout
  if (!shouldShowAnalysisLayout()) {
    return <>{children}</>;
  }

  // Show full analysis layout for main pages
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("analysis.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("analysis.description")}</p>
      </div>

      <NavTabs value={activeTab}>
        <NavTabsList>
          <NavTabsTrigger value="dashboards" asChild>
            <Link href={`/${locale}/platform/experiments/${id}/analysis/dashboards`}>
              {t("analysis.dashboards", "Dashboards")}
            </Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="visualizations" asChild>
            <Link href={`/${locale}/platform/experiments/${id}/analysis/visualizations`}>
              {t("analysis.visualizations")}
            </Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="notebooks" disabled>
            <span className="cursor-not-allowed opacity-50">{t("analysis.notebooks")}</span>
          </NavTabsTrigger>
        </NavTabsList>
        <div className="mt-6">{children}</div>
      </NavTabs>
    </div>
  );
}
