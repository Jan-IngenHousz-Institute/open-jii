import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ExperimentStatusBadge } from "~/components/ExperimentStatusBadge";

import type { Experiment } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components";

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
    return (
      <div className="text-[0.9rem] font-normal leading-[1.3125rem] text-[#68737B]">
        {t("experiments.noExperiments")}
      </div>
    );
  }

  if (horizontal) {
    // Horizontal layout for dashboard
    return (
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-12">
        {experiments.map((experiment) => {
          const experimentPath = archived
            ? `/platform/experiments-archive/${experiment.id}`
            : `/platform/experiments/${experiment.id}`;

          return (
            <Link key={experiment.id} href={experimentPath}>
              <div className="relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
                <div className="inline-flex">
                  <ExperimentStatusBadge status={experiment.status} />
                </div>
                <div className="mb-auto">
                  <h3 className="mb-2 break-words text-base font-semibold text-gray-900 md:text-lg">
                    {experiment.name}
                  </h3>
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
                <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
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
          const experimentPath = archived
            ? `/platform/experiments-archive/${experiment.id}`
            : `/platform/experiments/${experiment.id}`;

          return (
            <Link key={experiment.id} href={experimentPath}>
              <div className="relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
                <div className="inline-flex">
                  <ExperimentStatusBadge status={experiment.status} />
                </div>
                <div className="mb-auto">
                  <h3 className="mb-2 break-words text-base font-semibold text-gray-900 md:text-lg">
                    {experiment.name}
                  </h3>
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
                <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
