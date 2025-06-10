import { ExperimentDataTable } from "@/components/experiment-data-table";
import { use } from "react";

interface DataExampleProps {
  params: Promise<{ id: string }>;
}

export default function DataExample({ params }: DataExampleProps) {
  const { id } = use(params);
  return <ExperimentDataTable id={id} />;
}
