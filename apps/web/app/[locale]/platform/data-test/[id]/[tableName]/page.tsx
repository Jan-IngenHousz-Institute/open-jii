import { ExperimentDataTable } from "@/components/experiment-data-table";
import { use } from "react";

import type { Locale } from "@repo/i18n";

interface DataExampleProps {
  params: Promise<{ id: string; tableName: string; locale: Locale }>;
}

export default function DataExample({ params }: DataExampleProps) {
  const { id, tableName, locale } = use(params);

  return (
    <ExperimentDataTable experimentId={id} tableName={tableName} pageSize={10} locale={locale} />
  );
}
