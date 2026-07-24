import { buildProtocolMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ProtocolOverviewContent from "./protocol-overview-content";

interface ProtocolOverviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ProtocolOverviewPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildProtocolMetadata({ locale, id });
  });
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  return <ProtocolOverviewContent params={params} />;
}
