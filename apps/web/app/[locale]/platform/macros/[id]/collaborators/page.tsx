"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { use } from "react";

interface MacroCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Who this macro is shared with — a route of its own, so reaching it leaves the
 * details sidebar and the code behind rather than hiding them.
 *
 * The layout has already loaded the macro (and gated on it) before this renders,
 * so the hook resolves from cache and adds no request.
 */
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
