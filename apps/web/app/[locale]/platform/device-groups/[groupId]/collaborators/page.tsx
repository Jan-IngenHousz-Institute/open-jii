import { buildDeviceGroupMetadata } from "@/lib/platform-metadata";
import { safeMetadata } from "@/lib/safe-metadata";
import type { Metadata } from "next";

import GroupCollaboratorsContent from "./group-collaborators-content";

interface PageProps {
  params: Promise<{ locale: string; groupId: string }>;
}

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, groupId } = await params;
    return buildDeviceGroupMetadata({ locale, groupId, section: "collaborators" });
  });
}

export default function GroupCollaboratorsPage({ params }: PageProps) {
  return <GroupCollaboratorsContent params={params} />;
}
