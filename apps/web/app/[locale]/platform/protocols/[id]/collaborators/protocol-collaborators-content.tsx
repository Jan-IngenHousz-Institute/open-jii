"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { use } from "react";

interface ProtocolCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/** Protocol collaborators route; the layout's detail query supplies cached access. */
export default function ProtocolCollaboratorsPage({ params }: ProtocolCollaboratorsPageProps) {
  const { id } = use(params);
  const { data } = useProtocol(id);

  return (
    <ResourceCollaboratorsRoute
      resourceType="protocol"
      resourceId={id}
      capabilities={data?.capabilities}
    />
  );
}
