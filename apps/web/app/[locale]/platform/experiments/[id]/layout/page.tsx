import ExperimentLayoutContent from "./experiment-layout-content";

interface ExperimentLayoutPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function ExperimentLayoutPage({ params }: ExperimentLayoutPageProps) {
  return <ExperimentLayoutContent params={params} />;
}
