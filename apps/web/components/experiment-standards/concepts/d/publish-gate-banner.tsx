"use client";

import { formatList } from "@/components/calibrations/format-list";
import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

interface PublishGateBannerProps {
  experimentId: string;
  followed: StandardId[];
  /** The followed standards that still have steps, the ones publishing waits for. */
  waitingOn: StandardId[];
  stepCount: number;
}

/**
 * Why Publish is held: how many steps remain, for which standards, and the way to them. Carries
 * the held Publish button itself, so the panel below shows none.
 */
export function PublishGateBanner({
  experimentId,
  followed,
  waitingOn,
  stepCount,
}: PublishGateBannerProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");
  const { t: tDatasets } = useTranslation("datasets");
  const locale = useLocale();

  const names = formatList(
    locale,
    waitingOn.map((standard) => tStandards(`destination.${standard}`)),
  );

  // Scaffold: the concept and the choice ride on the address, so the steps open as chosen here.
  const query = new URLSearchParams({ readiness: "d", follow: followed.join(",") });
  const stepsHref = `/${locale}/platform/experiments/${experimentId}?${query.toString()}#${STANDARDS_READINESS_ANCHOR}`;

  return (
    <Card padding="none" className="shadow-none" data-testid="publish-gate">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <Lock aria-hidden className="text-muted-foreground size-5 shrink-0" />

        <div className="min-w-60 flex-1 space-y-0.5">
          <p className="text-sm font-medium">{t("gate.title", { count: stepCount })}</p>
          <p className="text-muted-foreground text-sm">
            {t("gate.description", { count: waitingOn.length, names })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={stepsHref}>{t("gate.seeSteps")}</Link>
          </Button>
          <Button disabled>
            <Plus className="size-4" />
            {tDatasets("list.publish")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
