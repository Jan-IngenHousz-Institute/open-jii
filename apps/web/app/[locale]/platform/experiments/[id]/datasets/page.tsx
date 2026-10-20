import ExperimentDatasetsContent from "./experiment-datasets-content";

interface ExperimentDatasetsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function ExperimentDatasetsPage({ params }: ExperimentDatasetsPageProps) {
  return <ExperimentDatasetsContent params={params} />;
}
