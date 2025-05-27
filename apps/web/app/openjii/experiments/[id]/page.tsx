"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { formatDate } from "@/util/date";
import { CalendarIcon } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@repo/ui/components";

interface ExperimentOverviewPageProps {
  params: { id: string };
}

export default function ExperimentOverviewPage({
  params,
}: ExperimentOverviewPageProps) {
  const { id } = params;
  const { data, isLoading, error } = useExperiment(id);
  if (isLoading) {
    return <div>Loading experiment details...</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title="Failed to load experiment" />;
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  const experiment = data.body;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-secondary">Active</Badge>;
      case "provisioning":
        return <Badge className="bg-highlight text-black">Provisioning</Badge>;
      case "archived":
        return <Badge className="bg-muted">Archived</Badge>;
      case "stale":
        return <Badge className="bg-tertiary">Stale</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Experiment info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{experiment.name}</CardTitle>
              <CardDescription>
                {experiment.description ?? "No description provided"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(experiment.status)}
              <Badge variant="outline" className="ml-2 capitalize">
                {experiment.visibility}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Created
              </h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(experiment.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Updated
              </h4>
              <p>{formatDate(experiment.updatedAt)}</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                Embargo Period
              </h4>
              <p>{experiment.embargoIntervalDays} days</p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">ID</h4>
              <p className="truncate font-mono text-xs">{experiment.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
