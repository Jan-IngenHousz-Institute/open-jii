"use client";

import { ResourceCollaborators } from "@/components/sharing/resource-collaborators";
import { use } from "react";

interface MacroCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

export default function MacroCollaboratorsPage({ params }: MacroCollaboratorsPageProps) {
  const { id } = use(params);
  return <ResourceCollaborators resourceType="macro" resourceId={id} />;
}
