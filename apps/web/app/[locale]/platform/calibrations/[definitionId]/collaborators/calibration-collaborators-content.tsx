"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { use } from "react";

interface CalibrationCollaboratorsPageProps {
  params: Promise<{ definitionId: string }>;
}

/** Calibration collaborators route; the layout's detail query supplies cached access. */
export default function CalibrationCollaboratorsPage({
  params,
}: CalibrationCollaboratorsPageProps) {
  const { definitionId } = use(params);
  const { data } = useCalibrationDefinition(definitionId);

  return (
    <ResourceCollaboratorsRoute
      resourceType="calibration_definition"
      resourceId={definitionId}
      capabilities={data?.capabilities}
    />
  );
}
