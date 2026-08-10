import { buildWorkbookMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import WorkbookCollaboratorsContent from "./workbook-collaborators-content";

interface WorkbookCollaboratorsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export function generateMetadata({ params }: WorkbookCollaboratorsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, id } = await params;
    return buildWorkbookMetadata({ locale, id, section: "collaborators" });
  });
}

export default function WorkbookCollaboratorsPage({ params }: WorkbookCollaboratorsPageProps) {
  return <WorkbookCollaboratorsContent params={params} />;
}
