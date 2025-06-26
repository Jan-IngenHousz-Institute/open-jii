import { ExperimentDataTable } from "@/components/experiment-data-table";
import { use } from "react";

interface DataExampleProps {
  params: Promise<{ id: string; tableName: string }>;
}

export default function DataExample({ params }: DataExampleProps) {
  const { id, tableName } = use(params);

  return <ExperimentDataTable experimentId={id} tableName={tableName} pageSize={15} />;
}
