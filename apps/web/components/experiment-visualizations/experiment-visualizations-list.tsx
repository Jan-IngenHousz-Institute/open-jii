"use client";

import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { AreaChart, Calendar, Trash2 } from "lucide-react";
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
  CardFooter,
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

  const getChartIcon = (_chartType: string) => {
    // You can customize this based on chart types
    return <AreaChart className="h-5 w-5" />;
  };

  if (visualizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <AreaChart className="text-muted-foreground mb-2 h-10 w-10" />
        <h3 className="mb-1 text-lg font-medium">{t("noVisualizations")}</h3>
        <p className="text-muted-foreground">{t("createVisualizations")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visualizations.map((visualization) => (
          <Card key={visualization.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <Badge variant="outline" className="mb-2">
                  {visualization.chartFamily} / {visualization.chartType}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenDeleteDialog(visualization)}
                >
                  <Trash2 className="text-muted-foreground h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="line-clamp-1">{visualization.name}</CardTitle>
              <CardDescription className="line-clamp-2">
                {visualization.description ?? t("noDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground flex items-center text-sm">
                <div className="flex items-center">
                  {getChartIcon(visualization.chartType)}
                  <span className="ml-1">{t(`chartTypes.${visualization.chartType}`)}</span>
                </div>
                <span className="mx-2">•</span>
                <div className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  {new Date(visualization.createdAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleViewVisualization(visualization)}
              >
                {t("view")}
              </Button>
            </CardFooter>
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
