"use client";

import { EditExperiment } from "@/components/edit-experiment";

interface ExperimentEditPageProps {
  params: { id: string };
}

export default function ExperimentEditPage({
  params,
}: ExperimentEditPageProps) {
  const { id } = params;
  return <EditExperiment experimentId={id} />;
}
