import { EditExperiment } from "@/components/edit-experiment";

interface ExperimentEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExperimentEditPage({
  params,
}: ExperimentEditPageProps) {
  const { id } = await params;
  return <EditExperiment experimentId={id} />;
}
