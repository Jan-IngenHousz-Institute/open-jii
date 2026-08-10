import { buildProtocolMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import ProtocolCollaboratorsContent from "./protocol-collaborators-content";

interface ProtocolCollaboratorsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: ProtocolCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildProtocolMetadata({ locale, id, section: "collaborators" });
  });
}

export default function ProtocolCollaboratorsPage({ params }: ProtocolCollaboratorsPageProps) {
  return <ProtocolCollaboratorsContent params={params} />;
}
