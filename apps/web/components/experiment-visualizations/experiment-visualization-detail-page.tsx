"use client";

import { ArrowLeft, Download, Edit, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentVisualization } from "../../hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { useExperimentVisualizationDelete } from "../../hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";

// Dynamic import of the renderer to avoid SSR issues
const ExperimentVisualizationRenderer = dynamic(
  () => import("./experiment-visualization-renderer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center">
        <div className="text-muted-foreground">Loading visualization...</div>
      </div>
    ),
  },
);

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
  const params = useParams();
  const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;

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

  const handleExport = () => {
    if (!visualization) return;
    // TODO: Implement chart export functionality
    toast({
      description: t("errors.exportComingSoon"),
    });
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
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{visualization.name}</h1>
            {visualization.description && (
              <p className="text-muted-foreground mt-1">{visualization.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("export")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            {t("edit")}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? t("deleting") : t("delete")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Visualization */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("chartPreview")}</CardTitle>
              <CardDescription>
                {t("chartInfo", {
                  type: visualization.config.chartType,
                  table: visualization.dataConfig.tableName,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExperimentVisualizationRenderer
                experimentId={experimentId}
                visualization={visualization}
                data={visualizationData?.rows}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with details */}
        <div className="space-y-6">
          {/* Data Source */}
          <Card>
            <CardHeader>
              <CardTitle>{t("dataSource")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("table")}</label>
                <p className="text-muted-foreground text-sm">
                  {visualization.dataConfig.tableName}
                </p>
              </div>

              {isDataLoading && (
                <div className="text-muted-foreground text-sm">{t("errors.loadingData")}</div>
              )}

              {visualizationData && (
                <div>
                  <label className="text-sm font-medium">{t("columns")}</label>
                  <div className="mt-1 space-y-1">
                    {visualization.dataConfig.dataSources.map((ds, index) => (
                      <div
                        key={index}
                        className="text-muted-foreground bg-muted rounded px-2 py-1 text-xs"
                      >
                        {ds.columnName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>{t("chartConfiguration")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("chartType")}</label>
                <p className="text-muted-foreground text-sm">
                  {visualization.config.chartType} ({visualization.chartFamily} family)
                </p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium">{t("configurationDetails")}</label>
                <div className="bg-muted/50 mt-2 rounded p-3">
                  <pre className="max-h-40 overflow-auto text-xs">
                    {JSON.stringify(visualization.config.config, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="text-muted-foreground text-xs">
                {t("createdAt")}: {new Date(visualization.createdAt).toLocaleString()}
              </div>

              {visualization.updatedAt !== visualization.createdAt && (
                <div className="text-muted-foreground text-xs">
                  {t("updatedAt")}: {new Date(visualization.updatedAt).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
