"use client";

import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { useExperimentDelete } from "../hooks/experiment/useExperimentDelete/useExperimentDelete";

interface ExperimentSettingsProps {
  experimentId: string;
}

export function ExperimentSettings({ experimentId }: ExperimentSettingsProps) {
  const { data, isLoading } = useExperiment(experimentId);
  const { mutateAsync: deleteExperiment, isPending: isDeleting } =
    useExperimentDelete();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();

  if (isLoading) {
    return <div>Loading experiment settings...</div>;
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  const experiment = data.body;

  const handleDeleteExperiment = async () => {
    await deleteExperiment({ params: { id: experimentId } });
    toast({
      description: "Experiment deleted successfully",
    });
    router.push("/openjii/experiments");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment Information</CardTitle>
        <CardDescription>
          View experiment details and danger zone options
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Created by:</span>{" "}
            {experiment.createdBy}
          </div>
          <div>
            <span className="font-medium">Created at:</span>{" "}
            {formatDate(experiment.createdAt)}
          </div>
          <div>
            <span className="font-medium">Last updated:</span>{" "}
            {formatDate(experiment.updatedAt)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h5 className="text-destructive mb-2 text-base font-medium">
            Danger Zone
          </h5>
          <p className="text-muted-foreground mb-4 text-sm">
            Once you delete an experiment, there is no going back. Please be
            certain.
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Experiment
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Are you sure you want to delete "{experiment.name}"? This action
                cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteExperiment}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
