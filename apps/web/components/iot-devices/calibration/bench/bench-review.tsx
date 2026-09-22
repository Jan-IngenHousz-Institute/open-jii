"use client";

import { useApproveCalibrationRun } from "@/hooks/iot/useApproveCalibrationRun/useApproveCalibrationRun";
import { useCalibrationRun } from "@/hooks/iot/useCalibrationRun/useCalibrationRun";
import { useRejectCalibrationRun } from "@/hooks/iot/useRejectCalibrationRun/useRejectCalibrationRun";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { CalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationReview } from "../wizard/calibration-review";
import { CalibrationWizardActions } from "../wizard/calibration-wizard-actions";
import type { BenchUnit } from "./bench-unit";

interface BenchReviewProps {
  units: BenchUnit[];
  outputSchema: CalibrationOutputSchema;
  onDone: () => void;
}

type Decision = "approved" | "rejected";

/**
 * The sitting's runs, decided one after another.
 *
 * Measuring and deciding are separated on purpose: an operator with a tray of hardware
 * should not be asked to read residuals with a lamp still warm, and a decision taken to
 * get back to the bench faster is the decision a batch gets wrong. Approving here puts the
 * coefficients in force; they reach the hardware when the unit is next on a port.
 */
export function BenchReview({ units, outputSchema, onDone }: BenchReviewProps) {
  const { t } = useTranslation("iot");

  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const approve = useApproveCalibrationRun();
  const reject = useRejectCalibrationRun();

  const unit = units.at(index);
  const run = useCalibrationRun(unit?.runId ?? null);
  const isDeciding = approve.isPending || reject.isPending;

  function advance() {
    setError(null);
    if (index + 1 < units.length) {
      setIndex(index + 1);
      return;
    }
    onDone();
  }

  async function decide(decision: Decision) {
    if (!unit) {
      return;
    }

    setError(null);
    try {
      if (decision === "approved") {
        await approve.mutateAsync({ runId: unit.runId });
      } else {
        await reject.mutateAsync({ runId: unit.runId });
      }
      setDecisions((made) => ({ ...made, [unit.runId]: decision }));
      advance();
    } catch (caught) {
      setError(parseApiError(caught)?.message ?? t("iot.calibration.review.decisionFailed"));
    }
  }

  function renderActions() {
    return (
      <CalibrationWizardActions
        secondary={
          <Button
            type="button"
            variant="outline"
            onClick={() => void decide("rejected")}
            disabled={isDeciding}
          >
            {t("iot.calibration.review.reject")}
          </Button>
        }
        primary={
          <Button type="button" onClick={() => void decide("approved")} disabled={isDeciding}>
            {t("iot.calibration.review.approve")}
          </Button>
        }
      />
    );
  }

  if (!unit) {
    return null;
  }

  const decided = decisions[unit.runId];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{unit.deviceName ?? unit.serial}</h2>
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("iot.calibration.bench.unitOf", { index: index + 1, total: units.length })}
        </p>
      </div>

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {run.isLoading || !run.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <CalibrationReview
          run={run.data}
          payload={run.data.payload ?? {}}
          active={null}
          outputSchema={outputSchema}
        />
      )}

      {decided === undefined ? (
        renderActions()
      ) : (
        <CalibrationWizardActions
          primary={
            <Button type="button" onClick={advance}>
              {t("iot.calibration.bench.nextToReview")}
            </Button>
          }
        />
      )}
    </div>
  );
}
