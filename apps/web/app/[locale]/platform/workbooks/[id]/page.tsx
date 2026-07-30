import { buildWorkbookMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import WorkbookOverviewContent from "./workbook-overview-content";

interface WorkbookOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: WorkbookOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildWorkbookMetadata({ locale, id });
  });
}

export default function WorkbookOverviewPage({ params }: WorkbookOverviewPageProps) {
  return <WorkbookOverviewContent params={params} />;
}
