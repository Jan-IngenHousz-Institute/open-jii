"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { Upload } from "lucide-react";
import { use } from "react";
import * as React from "react";
import { AmbyteUploadModal } from "~/components/experiment-data/ambyte-upload-modal/ambyte-upload-modal";
import { ExperimentDataSampleTables } from "~/components/experiment-data/experiment-data-sample-tables";
import { useLocale } from "~/hooks/useLocale";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components";

interface ExperimentDataPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function ExperimentDataPage({ params }: ExperimentDataPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");
  const locale = useLocale();
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data) {
    return <div>{t("notFound")}</div>;
  }

  const handleUploadSuccess = () => {
    // Refresh experiment data after successful upload
    setUploadModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-medium">{t("experimentData.title")}</h4>
          <p className="text-muted-foreground text-sm">{t("experimentData.description")}</p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          {t("experimentData.uploadData", "Upload Data")}
        </Button>
      </div>

      <ExperimentDataSampleTables experimentId={id} sampleSize={5} locale={locale} />

      <AmbyteUploadModal
        experimentId={id}
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
