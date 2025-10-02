"use client";

import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle, Separator } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentVisualization } from "../../hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { useExperimentVisualizationDelete } from "../../hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

interface ExperimentVisualizationDetailPageProps {
  visualizationId: string;
  experimentId: string;
}

export default function ExperimentVisualizationDetailPage({
  visualizationId,
  experimentId,
}: ExperimentVisualizationDetailPageProps) {
  const { t } = useTranslation("experimentVisualizations");
  const router = useRouter();
  const locale = useLocale();

  // Fetch visualization data
  const {
    data: visualizationResponse,
    isLoading,
    error: visualizationError,
  } = useExperimentVisualization(visualizationId, experimentId);

  const visualization = visualizationResponse?.body;

  // Fetch the actual data for this visualization (only if visualization is loaded)
  const { data: visualizationData, isLoading: isDataLoading } = useExperimentVisualizationData(
    experimentId,
    visualization
      ? {
          tableName: visualization.dataConfig.tableName,
          columns: visualization.dataConfig.dataSources.map((ds) => ds.columnName),
        }
      : { tableName: "", columns: [] }, // Fallback when visualization not loaded
  );

  const { mutate: deleteVisualization, isPending: isDeleting } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      toast({
        description: t("experimentVisualizations.deleteSuccess"),
      });
      router.push(`/${locale}/platform/experiments/${experimentId}`);
    },
  });

  const handleEdit = () => {
    if (!visualization) return;
    router.push(
      `/${locale}/platform/experiments/${experimentId}/visualizations/${visualization.id}/edit`,
    );
  };

  const handleDelete = () => {
    if (!visualization) return;
    deleteVisualization({
      params: {
        id: experimentId,
        visualizationId: visualization.id,
      },
    });
  };

  const handleBack = () => {
    router.push(`/${locale}/platform/experiments/${experimentId}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">{t("loadingVisualization")}</div>
      </div>
    );
  }

  // Error state
  if (visualizationError || !visualization) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <div className="text-destructive">{t("failedToLoadVisualization")}</div>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button onClick={handleBack} variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Button>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">{visualization.name}</h1>
                {visualization.description && (
                  <p className="text-muted-foreground text-lg">{visualization.description}</p>
                )}
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-1 font-medium">
                    {visualization.chartType}
                  </span>
                  <span>•</span>
                  <span>{visualization.chartFamily} family</span>
                  <span>•</span>
                  <span>{new Date(visualization.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleEdit} className="gap-2">
                <Edit className="h-4 w-4" />
                {t("edit")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? t("deleting") : t("delete")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 pb-16">
        {/* Full-width Chart */}
        <div className="mb-12">
          <Card className="bg-card/50 border-0 shadow-lg backdrop-blur">
            <CardContent className="p-8">
              <div className="min-h-[5f00px] w-full">
                <ExperimentVisualizationRenderer
                  experimentId={experimentId}
                  visualization={visualization}
                  data={visualizationData?.rows}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Information Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Data Source */}
          <Card className="shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                {t("dataSource")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-foreground text-sm font-semibold">{t("table")}</label>
                <div className="bg-muted/50 rounded-lg p-3">
                  <code className="font-mono text-sm">{visualization.dataConfig.tableName}</code>
                </div>
              </div>

              {isDataLoading && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <div className="bg-muted-foreground h-2 w-2 animate-pulse rounded-full"></div>
                  {t("errors.loadingData")}
                </div>
              )}

              {visualizationData && (
                <div className="space-y-3">
                  <label className="text-foreground text-sm font-semibold">{t("columns")}</label>
                  <div className="space-y-2">
                    {visualization.dataConfig.dataSources.map((ds, index) => (
                      <div
                        key={index}
                        className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                        <code className="font-mono text-sm">{ds.columnName}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart Configuration */}
          <Card className="shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                {t("chartConfiguration")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-foreground text-sm font-semibold">{t("chartType")}</label>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm">
                    <span className="font-mono font-medium">{visualization.chartType}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      ({visualization.chartFamily} family)
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-foreground text-sm font-semibold">
                  {t("configurationDetails")}
                </label>
                <div className="bg-muted/20 rounded-lg border p-4">
                  <pre className="max-h-48 overflow-auto font-mono text-xs leading-relaxed">
                    {JSON.stringify(visualization.config?.config ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="border-muted/30 flex items-center justify-between border-b py-2">
                  <span className="text-muted-foreground text-sm font-medium">
                    {t("createdAt")}
                  </span>
                  <span className="font-mono text-sm">
                    {new Date(visualization.createdAt).toLocaleString()}
                  </span>
                </div>

                {visualization.updatedAt !== visualization.createdAt && (
                  <div className="border-muted/30 flex items-center justify-between border-b py-2">
                    <span className="text-muted-foreground text-sm font-medium">
                      {t("updatedAt")}
                    </span>
                    <span className="font-mono text-sm">
                      {new Date(visualization.updatedAt).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-muted-foreground text-sm font-medium">
                    Visualization ID
                  </span>
                  <code className="bg-muted/50 block break-all rounded p-2 font-mono text-xs">
                    {visualization.id}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
