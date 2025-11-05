"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface AnalysisLayoutProps {
  children: React.ReactNode;
}

export default function AnalysisLayout({ children }: AnalysisLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { t } = useTranslation("experiments");

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes("/visualizations")) return "visualizations";
    if (pathname.includes("/notebooks")) return "notebooks";
    return "visualizations"; // Default to visualizations
  };

  // Check if we should show the full analysis layout (only for main pages, not sub-pages)
  const shouldShowAnalysisLayout = () => {
    // Show layout for: /analysis/visualizations (main list page)
    // Don't show for: /analysis/visualizations/[id]
    return (
      pathname === `/${locale}/platform/experiments-archive/${id}/analysis/visualizations` ||
      pathname === `/${locale}/platform/experiments-archive/${id}/analysis/notebooks`
    );
  };

  const activeTab = getActiveTab();

  // If it's a sub-page (detail), just render children without layout
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

      <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-96 grid-cols-2">
          <TabsTrigger value="visualizations" asChild>
            <Link href={`/${locale}/platform/experiments-archive/${id}/analysis/visualizations`}>
              {t("analysis.visualizations")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="notebooks" disabled>
            <span className="cursor-not-allowed opacity-50">{t("analysis.notebooks")}</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
