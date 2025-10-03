import { ArrowRight, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { ExperimentStatusBadge } from "~/components/ExperimentStatusBadge";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

export function ExperimentOverviewCards({
  experiments,
  archived = false,
}: {
  experiments: Experiment[] | undefined;
  archived?: boolean;
}) {
  const { t } = useTranslation("experiments");

  if (!experiments) {
    return <span>{t("experiments.loadingExperiments")}</span>;
  }

  if (experiments.length === 0) {
    return <span>{t("experiments.noExperiments")}</span>;
  }

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
              <Card className="bg-white transition-shadow hover:shadow-md">
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
