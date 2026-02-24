"use client";

import { ErrorDisplay } from "@/components/error-display";
import { BarChart3, Database, FileSpreadsheet, Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import * as React from "react";
import { DataUploadModal } from "~/components/experiment-data/data-upload-modal/data-upload-modal";
import type { UploadStep } from "~/components/experiment-data/data-upload-modal/data-upload-modal";
import { ExperimentDataTable } from "~/components/experiment-data/experiment-data-table";
import { env } from "~/env";
import { useExperimentAccess } from "~/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { tsr } from "~/lib/tsr";

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
  const [uploadModalStep, setUploadModalStep] = React.useState<UploadStep>("selection");

  // Check if metadata already exists for this experiment
  const { data: metadataResponse } = tsr.experiments.getExperimentMetadata.useQuery({
    queryData: { params: { id } },
    queryKey: ["experiment", id, "metadata"],
  });
  const hasMetadata = metadataResponse?.body != null && metadataResponse.body.columns?.length > 0;

  const openMetadataUpload = () => {
    setUploadModalStep("metadata-upload");
    setUploadModalOpen(true);
  };

  const openSensorDataUpload = () => {
    setUploadModalStep("file-upload");
    setUploadModalOpen(true);
  };

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

  if (!tables || tables.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
            <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openMetadataUpload} disabled={!hasAccess}>
              {hasMetadata ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              {hasMetadata ? t("experimentData.editMetadata") : t("experimentData.uploadMetadata")}
            </Button>
            <Button onClick={openSensorDataUpload} disabled={!hasAccess}>
              <Database className="mr-2 h-4 w-4" />
              {t("experimentData.uploadSensorData")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
            <BarChart3 className="text-muted-foreground h-12 w-12" />
          </div>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            {t("experimentData.noData")}
          </p>
          <Link
            href={`${env.NEXT_PUBLIC_DOCS_URL}/docs/data-platform/mobile-app`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="muted">{t("experimentData.readMore")}</Button>
          </Link>
        </div>

        <DataUploadModal
          experimentId={id}
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          initialStep={uploadModalStep}
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={openMetadataUpload} disabled={!hasAccess}>
            {hasMetadata ? (
              <Pencil className="mr-2 h-4 w-4" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            {hasMetadata ? t("experimentData.editMetadata") : t("experimentData.uploadMetadata")}
          </Button>
          <Button onClick={openSensorDataUpload} disabled={!hasAccess}>
            <Database className="mr-2 h-4 w-4" />
            {t("experimentData.uploadSensorData")}
          </Button>
        </div>
      </div>

      <NavTabs defaultValue={tables[0].identifier} className="max-w-full">
        <NavTabsList>
          {tables.map((table) => (
            <NavTabsTrigger key={table.identifier} value={table.identifier}>
              <span className="truncate">
                {table.displayName} ({table.totalRows})
              </span>
            </NavTabsTrigger>
          ))}
        </NavTabsList>
        {tables.map((table) => (
          <NavTabsContent key={table.identifier} value={table.identifier} className="mt-6">
            <ExperimentDataTable
              experimentId={id}
              tableName={table.identifier}
              displayName={table.displayName}
              defaultSortColumn={table.defaultSortColumn}
              errorColumn={table.errorColumn}
              pageSize={10}
            />
          </NavTabsContent>
        ))}
      </NavTabs>

      <DataUploadModal
        experimentId={id}
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        initialStep={uploadModalStep}
      />
    </div>
  );
}
