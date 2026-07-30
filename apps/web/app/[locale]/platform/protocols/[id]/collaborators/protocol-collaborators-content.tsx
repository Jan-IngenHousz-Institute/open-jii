"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { use } from "react";

interface ProtocolCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Who this protocol is shared with — a route of its own, so reaching it leaves
 * the details sidebar and the steps behind rather than hiding them.
 *
 * The layout has already loaded the protocol (and gated on it) before this
 * renders, so the hook resolves from cache and adds no request.
 */
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
