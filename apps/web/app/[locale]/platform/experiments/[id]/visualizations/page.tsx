"use client";

import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, PlusCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  const { data: visualizationsData, isLoading } = useExperimentVisualizations({
    experimentId: id,
    initialChartFamily: undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button
          onClick={() => router.push(`/${locale}/platform/experiments/${id}/visualizations/new`)}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("createNew")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("all")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ExperimentVisualizationsList
              visualizations={visualizationsData?.body ?? []}
              experimentId={id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
