"use client";

import { ErrorDisplay } from "@/components/error-display";
import { Upload } from "lucide-react";
import { notFound } from "next/navigation";
import { use } from "react";
import * as React from "react";
import { DataUploadModal } from "~/components/experiment-data/data-upload-modal/data-upload-modal";
import { ExperimentDataTable } from "~/components/experiment-data/experiment-data-table";
import { useExperimentAccess } from "~/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";

import { ExperimentTableName } from "@repo/api";
import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  NavTabs,
  NavTabsContent,
  NavTabsList,
  NavTabsTrigger,
  Skeleton,
} from "@repo/ui/components";

interface ExperimentDataPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function ExperimentDataPage({ params }: ExperimentDataPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperimentAccess(id);
  const { tables, isLoading: isLoadingTables, error: tablesError } = useExperimentTables(id);
  const { t } = useTranslation("experiments");
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  if (isLoading || isLoadingTables) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (tablesError) {
    return <ErrorDisplay error={tablesError} title={t("failedToLoad")} />;
  }

  if (!data) {
    return <div>{t("notFound")}</div>;
  }

  const experiment = data.body.experiment;
  const hasAccess = data.body.isAdmin;

  // Check if experiment is archived - if so, redirect to not found (should use archive route)
  if (experiment.status === "archived") {
    notFound();
  }

  // Filter out device table
  const filteredTables = tables?.filter((table) => table.name !== ExperimentTableName.DEVICE) ?? [];

  if (!tables || filteredTables.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
            <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
          </div>
          <Button onClick={() => setUploadModalOpen(true)} disabled={!hasAccess}>
            <Upload className="mr-2 h-4 w-4" />
            {t("experimentData.uploadData")}
          </Button>
        </div>

        <div className="text-muted-foreground py-12 text-center">{t("experimentData.noData")}</div>

        <DataUploadModal
          experimentId={id}
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
          <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)} disabled={!hasAccess}>
          <Upload className="mr-2 h-4 w-4" />
          {t("experimentData.uploadData")}
        </Button>
      </div>

      <NavTabs defaultValue={filteredTables[0].name} className="max-w-full">
        <NavTabsList className="max-w-full flex-wrap">
          {filteredTables.map((table) => (
            <NavTabsTrigger key={table.name} value={table.name}>
              <span className="truncate">
                {table.displayName} ({table.totalRows})
              </span>
            </NavTabsTrigger>
          ))}
        </NavTabsList>
        {filteredTables.map((table) => (
          <NavTabsContent key={table.name} value={table.name} className="mt-6">
            <ExperimentDataTable
              experimentId={id}
              tableName={table.name}
              displayName={table.displayName}
              defaultSortColumn={table.defaultSortColumn}
              errorColumn={table.errorColumn}
              pageSize={10}
            />
          </NavTabsContent>
        ))}
      </NavTabs>

      <DataUploadModal experimentId={id} open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </div>
  );
}
