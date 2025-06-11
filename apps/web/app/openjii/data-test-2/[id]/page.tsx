import { ExperimentDataTableV2 } from "@/components/experiment-data-table-v2";
import { use } from "react";

interface DataExampleProps {
  params: Promise<{ id: string }>;
}

export default function DataExample({ params }: DataExampleProps) {
  const { id } = use(params);
  return <ExperimentDataTableV2 id={id} />;
}
