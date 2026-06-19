"use client";

import { ResourceCollaborators } from "@/components/sharing/resource-collaborators";
import { use } from "react";

interface ProtocolCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolCollaboratorsPage({ params }: ProtocolCollaboratorsPageProps) {
  const { id } = use(params);
  return <ResourceCollaborators resourceType="protocol" resourceId={id} />;
}
