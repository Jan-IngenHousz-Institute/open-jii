"use client";

import { useLocale } from "@/shared/i18n/useLocale";
import { usePathname, useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface AnalysisLayoutProps {
  children: React.ReactNode;
}

export default function AnalysisLayout({ children }: AnalysisLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { t } = useTranslation("experiments");

  // Hide the section header on detail/edit pages so they get the full canvas.
  // Only the main list pages render the heading + segmented switcher (the
  // switcher itself lives in the page so it can sit inline with the page's
  // create CTA).
  const shouldShowAnalysisLayout = () => {
    return (
      pathname === `/${locale}/platform/experiments/${id}/analysis/visualizations` ||
      pathname === `/${locale}/platform/experiments/${id}/analysis/notebooks`
    );
  };

  if (!shouldShowAnalysisLayout()) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("analysis.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("analysis.description")}</p>
      </div>
      {children}
    </div>
  );
}
