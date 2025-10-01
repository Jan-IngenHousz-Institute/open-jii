"use client";

import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { AreaChart, Calendar, Edit, Trash2, ArrowRight, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
}

export default function ExperimentVisualizationsList({
  visualizations,
  experimentId,
}: ExperimentVisualizationsListProps) {
  const { t } = useTranslation("experimentVisualizations");
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVisualization, setSelectedVisualization] =
    useState<ExperimentVisualization | null>(null);

  const { mutate: deleteVisualization } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      toast({
        description: t("deleteSuccess"),
      });
      setDeleteDialogOpen(false);
    },
  });

  const handleOpenDeleteDialog = (visualization: ExperimentVisualization) => {
    setSelectedVisualization(visualization);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (selectedVisualization) {
      deleteVisualization({
        params: {
          id: experimentId,
          visualizationId: selectedVisualization.id,
        },
      });
    }
  };

  const handleViewVisualization = (visualization: ExperimentVisualization) => {
    // Navigate to the visualization view
    router.push(`/platform/experiments/${experimentId}/visualizations/${visualization.id}`);
  };

  const handleEditVisualization = (visualization: ExperimentVisualization) => {
    // Navigate to the visualization edit page
    router.push(`/platform/experiments/${experimentId}/visualizations/${visualization.id}/edit`);
  };

  const getChartIcon = (chartType: string) => {
    const iconClass = "h-4 w-4";

    switch (chartType.toLowerCase()) {
      case "line":
      case "lineplot":
        return <TrendingUp className={iconClass} />;
      case "scatter":
      case "scatterplot":
        return <AreaChart className={iconClass} />;
      default:
        return <AreaChart className={iconClass} />;
    }
  };

  if (visualizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted/30 mb-6 rounded-full p-6">
          <AreaChart className="text-muted-foreground/60 h-12 w-12" />
        </div>
        <div className="max-w-sm space-y-2">
          <h3 className="text-foreground text-xl font-semibold">{t("noVisualizations")}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("createVisualizations")}
          </p>
        </div>
        <div className="mt-8">
          <Button
            onClick={() => router.push(`/platform/experiments/${experimentId}/visualizations/new`)}
            className="font-medium"
          >
            {t("createFirstVisualization")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visualizations.map((visualization) => (
          <Card
            key={visualization.id}
            className="border-border/50 hover:border-primary/20 hover:shadow-primary/5 group overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between">
                <Badge
                  variant="secondary"
                  className="text-primary hover:bg-primary/15 border-primary/20 bg-primary/10 px-3 py-1 font-medium"
                >
                  <div className="flex items-center gap-1">
                    {getChartIcon(visualization.chartType)}
                    <span className="text-xs">{visualization.chartFamily}</span>
                  </div>
                </Badge>
                <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted-foreground/10 h-8 w-8"
                    onClick={() => handleEditVisualization(visualization)}
                  >
                    <Edit className="text-muted-foreground hover:text-foreground h-4 w-4 transition-colors" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-destructive/10 h-8 w-8"
                    onClick={() => handleOpenDeleteDialog(visualization)}
                  >
                    <Trash2 className="text-muted-foreground hover:text-destructive h-4 w-4 transition-colors" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <CardTitle
                  className="group-hover:text-primary line-clamp-1 cursor-pointer text-lg font-semibold transition-colors hover:underline"
                  onClick={() => handleViewVisualization(visualization)}
                >
                  {visualization.name}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                  {visualization.description ?? t("noDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  <div className="bg-muted/50 flex items-center gap-1.5 rounded-full px-2.5 py-1">
                    <AreaChart className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {t(`chartTypes.${visualization.chartType}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(visualization.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary/10 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewVisualization(visualization);
                  }}
                >
                  <ArrowRight className="text-muted-foreground hover:text-primary h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
