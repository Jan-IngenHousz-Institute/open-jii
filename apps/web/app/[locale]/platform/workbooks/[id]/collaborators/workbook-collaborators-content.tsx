"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { use } from "react";

interface WorkbookCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Who this workbook is shared with — a route of its own, so reaching it leaves
 * the notebook editor, its metadata and the danger zone behind rather than
 * hiding them.
 *
 * The layout has already loaded the workbook (and gated on it) before this
 * renders, so the hook resolves from cache and adds no request.
 */
export default function WorkbookCollaboratorsPage({ params }: WorkbookCollaboratorsPageProps) {
  const { id } = use(params);
  const { data } = useWorkbook(id);

  return (
    <ResourceCollaboratorsRoute
      resourceType="workbook"
      resourceId={id}
      capabilities={data?.capabilities}
    />
  );
}
