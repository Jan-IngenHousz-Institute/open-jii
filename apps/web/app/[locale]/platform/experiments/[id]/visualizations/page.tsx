"use client";

import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, PlusCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";

import type { ChartFamily } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components";

// Import dynamically to avoid path issues
const ExperimentVisualizationsList = dynamic(
  () => import("@/components/experiment-visualizations/experiment-visualizations-list"),
  { ssr: false },
);

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  const {
    data: visualizationsData,
    isLoading,
    chartFamily,
    setChartFamily,
  } = useExperimentVisualizations({
    experimentId: id,
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
          <Tabs
            value={chartFamily ?? "all"}
            onValueChange={(value) =>
              setChartFamily(value !== "all" ? (value as ChartFamily) : undefined)
            }
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">{t("chartFamilies.all")}</TabsTrigger>
              <TabsTrigger value="basic">{t("chartFamilies.basic")}</TabsTrigger>
              <TabsTrigger value="scientific">{t("chartFamilies.scientific")}</TabsTrigger>
              <TabsTrigger value="3d">{t("chartFamilies.3d")}</TabsTrigger>
              <TabsTrigger value="statistical">{t("chartFamilies.statistical")}</TabsTrigger>
            </TabsList>

            <TabsContent value={chartFamily ?? "all"} className="mt-0">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
