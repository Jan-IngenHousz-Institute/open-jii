"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { use } from "react";

interface WorkbookCollaboratorsPageProps {
  params: Promise<{ id: string }>;
}

/** Workbook collaborators route; the layout's detail query supplies cached access. */
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
