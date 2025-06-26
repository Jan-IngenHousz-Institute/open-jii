import { ExperimentDataSampleTables } from "@/components/experiment-data-table";
import { use } from "react";

import type { Locale } from "@repo/i18n";

interface DataExampleProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function DataExample({ params }: DataExampleProps) {
  const { id, locale } = use(params);

  return <ExperimentDataSampleTables experimentId={id} locale={locale} />;
}
