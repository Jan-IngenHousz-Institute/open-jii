"use client";

import { ResourceCollaborators } from "@/components/sharing/resource-collaborators";
import { use } from "react";

interface WorkbookCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkbookCollaboratorsPage({ params }: WorkbookCollaboratorsPageProps) {
  const { id } = use(params);
  return <ResourceCollaborators resourceType="workbook" resourceId={id} />;
}
