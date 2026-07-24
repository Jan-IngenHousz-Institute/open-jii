import { buildMacroMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import MacroOverviewContent from "./macro-overview-content";

interface MacroOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: MacroOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildMacroMetadata({ locale, id });
  });
}

export default function MacroOverviewPage({ params }: MacroOverviewPageProps) {
  return <MacroOverviewContent params={params} />;
}
