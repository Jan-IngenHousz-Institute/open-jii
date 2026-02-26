"use client";

import { ArrowLeft, Edit, Trash2, ChevronDown, Settings } from "lucide-react";
import { notFound, useRouter } from "next/navigation";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentAccess } from "../../hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualization } from "../../hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useExperimentVisualizationDelete } from "../../hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

interface ExperimentVisualizationDetailsProps {
  visualizationId: string;
  experimentId: string;
  isArchiveContext?: boolean;
}

export default function ExperimentVisualizationDetails({
  visualizationId,
  experimentId,
  isArchiveContext = false,
}: ExperimentVisualizationDetailsProps) {
  const { t } = useTranslation("experimentVisualizations");
  const router = useRouter();
  const locale = useLocale();

  // Check experiment access and status
  const { data: accessData } = useExperimentAccess(experimentId);
  const experiment = accessData?.body;
  const isArchived = experiment?.experiment.status === "archived";
  const hasAccess = accessData?.body.isAdmin;
  // Redirect archived experiments to 404 when accessed via non-archive routes
  if (isArchived && !isArchiveContext) {
    notFound();
  }

  // Fetch visualization data
  const {
    data: visualizationResponse,
    isLoading,
    error: visualizationError,
  } = useExperimentVisualization(visualizationId, experimentId);

  const visualization = visualizationResponse?.body;

  const { mutate: deleteVisualization, isPending: isDeleting } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      toast({
        description: t("ui.messages.deleteSuccess"),
      });
      router.push(`/${locale}/platform/experiments/${experimentId}`);
    },
  });

  const handleEdit = () => {
    if (!visualization) return;
    router.push(
      `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${visualization.id}/edit`,
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
        <div className="text-muted-foreground">{t("ui.messages.loading")}</div>
      </div>
    );
  }

  // Error state
  if (visualizationError || !visualization) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <div className="text-destructive">{t("ui.messages.failedToLoad")}</div>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("ui.actions.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Visualization Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{visualization.name}</CardTitle>
              {visualization.description && (
                <p className="text-muted-foreground mt-2">{visualization.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isArchived || !hasAccess}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-surface gap-2 disabled:hover:bg-transparent"
                  >
                    <Settings className="h-4 w-4" />
                    {t("ui.actions.title")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t("ui.actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? t("ui.actions.deleting") : t("ui.actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("ui.labels.createdBy")}
              </h4>
              <p>
                {visualization.createdByName ?? visualization.createdBy.substring(0, 8) + "..."}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("ui.labels.createdAt")}
              </h4>
              <p>{new Date(visualization.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("ui.labels.updatedAt")}
              </h4>
              <p>{new Date(visualization.updatedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">Data Source</h4>
              <p className="truncate font-mono text-sm">{visualization.dataConfig.tableName}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">Columns</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex cursor-pointer items-center gap-1">
                    <p className="text-sm">{visualization.dataConfig.dataSources.length} columns</p>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64 max-w-96">
                  {visualization.dataConfig.dataSources.map((ds, index) => (
                    <DropdownMenuItem
                      key={index}
                      className="flex cursor-default items-center justify-between hover:bg-transparent focus:bg-transparent"
                    >
                      <code className="break-all font-mono text-sm">{ds.columnName}</code>
                      <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs">
                        {ds.role}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 pb-16">
        {/* Full-width Chart */}
        <div className="mb-12">
          <div className="flex w-full flex-col">
            <ExperimentVisualizationRenderer
              experimentId={experimentId}
              visualization={visualization}
              showDescription={false}
              showTitle={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
