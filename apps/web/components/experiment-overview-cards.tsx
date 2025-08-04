import { ArrowRight, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { ExperimentStatusBadge } from "~/components/ExperimentStatusBadge";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

export function ExperimentOverviewCards({
  experiments,
}: {
  experiments: Experiment[] | undefined;
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
          return (
            <Card key={experiment.id} className="bg-white transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-2 max-w-xs overflow-hidden truncate whitespace-nowrap font-semibold text-gray-900">
                      {experiment.name}
                    </h3>
                    <ExperimentStatusBadge status={experiment.status} />
                  </div>
                  <IconComponent className="mt-1 h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={`/platform/experiments/${experiment.id}`}>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-normal text-gray-900 hover:bg-transparent hover:text-gray-700"
                  >
                    {t("experiments.viewDetails")}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
