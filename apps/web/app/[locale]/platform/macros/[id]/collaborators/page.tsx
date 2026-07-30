import { buildMacroMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import MacroCollaboratorsContent from "./macro-collaborators-content";

interface MacroCollaboratorsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: MacroCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildMacroMetadata({ locale, id, section: "collaborators" });
  });
}

export default function MacroCollaboratorsPage({ params }: MacroCollaboratorsPageProps) {
  return <MacroCollaboratorsContent params={params} />;
}
