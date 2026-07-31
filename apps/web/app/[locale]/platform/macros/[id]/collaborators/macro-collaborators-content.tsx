"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { use } from "react";

interface MacroCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/** Macro collaborators route; the layout's detail query supplies cached access. */
export default function MacroCollaboratorsPage({ params }: MacroCollaboratorsPageProps) {
  const { id } = use(params);
  const { data } = useMacro(id);

  return (
    <ResourceCollaboratorsRoute
      resourceType="macro"
      resourceId={id}
      capabilities={data?.capabilities}
    />
  );
}
