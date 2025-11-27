import { ArrowRight, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { ExperimentStatusBadge } from "~/components/ExperimentStatusBadge";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader, RichTextRenderer } from "@repo/ui/components";

export function ExperimentOverviewCards({
  experiments,
  archived = false,
  horizontal = false,
}: {
  experiments: Experiment[] | undefined;
  archived?: boolean;
  horizontal?: boolean;
}) {
  const { t } = useTranslation("experiments");

  if (!experiments) {
    return <span>{t("experiments.loadingExperiments")}</span>;
  }

  if (experiments.length === 0) {
    return <span>{t("experiments.noExperiments")}</span>;
  }

  if (horizontal) {
    // Horizontal layout for dashboard
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {experiments.map((experiment) => {
          const experimentPath = archived
            ? `/platform/experiments-archive/${experiment.id}`
            : `/platform/experiments/${experiment.id}`;

          return (
            <Link key={experiment.id} href={experimentPath}>
              <div className="flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
                <div className="inline-flex">
                  <ExperimentStatusBadge status={experiment.status} />
                </div>
                <div className="mb-auto">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{experiment.name}</h3>
                  <div className="overflow-hidden text-sm text-gray-500">
                    <RichTextRenderer
                      content={experiment.description ?? " "}
                      truncate
                      maxLines={3}
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  {t("lastUpdate")}: {new Date(experiment.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  // Original grid layout
  return (
    <>
      {/* Experiments Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {experiments.map((experiment) => {
          const isPrivate = experiment.visibility === zExperimentVisibility.enum.private;
          const IconComponent = isPrivate ? Lock : Globe;
          const iconDescription = isPrivate ? t("visibility.private") : t("visibility.public");
          const experimentPath = archived
            ? `/platform/experiments-archive/${experiment.id}`
            : `/platform/experiments/${experiment.id}`;
          return (
            <Link key={experiment.id} href={experimentPath}>
              <Card className="border border-gray-200 bg-white transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 overflow-hidden truncate whitespace-nowrap font-semibold text-gray-900">
                        {experiment.name}
                      </h3>
                      <ExperimentStatusBadge status={experiment.status} />
                    </div>
                    <span title={iconDescription}>
                      <IconComponent
                        className="mt-1 h-4 w-4 text-gray-400"
                        aria-description={iconDescription}
                      />
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-hidden text-sm text-gray-500">
                    <RichTextRenderer
                      content={experiment.description || " "}
                      truncate
                      maxLines={3}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-6 h-auto w-full justify-between p-0 font-normal text-gray-700 hover:text-gray-900"
                  >
                    {t("experiments.viewDetails")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
