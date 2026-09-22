"use client";

import { useAllCalibrationDefinitions } from "@/hooks/iot/useAllCalibrationDefinitions/useAllCalibrationDefinitions";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationDefinitionPicker } from "../wizard/calibration-definition-picker";
import { CalibrationBenchSession } from "./calibration-bench-session";

/**
 * The bench: a procedure, a rig, and whatever hardware is put in front of it.
 *
 * The procedure is chosen once and the session is mounted under it, so the rig survives
 * every unit that passes through. Changing the procedure ends the session, because a
 * different procedure is a different rig.
 */
export function CalibrationBench() {
  const { t } = useTranslation("iot");
  const [definitionId, setDefinitionId] = useState<string | null>(null);

  const definitions = useAllCalibrationDefinitions();
  const definition = useCalibrationDefinition(definitionId);

  if (definitionId === null) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-muted-foreground text-sm">{t("iot.calibration.bench.chooseFirst")}</p>
        <CalibrationDefinitionPicker
          definitions={definitions.data}
          isLoading={definitions.isLoading}
          isError={definitions.isError}
          selectedId={null}
          onSelect={setDefinitionId}
        />
      </div>
    );
  }

  if (definition.isLoading || !definition.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    // Keyed by the procedure: changing it is a different rig, so the session starts over
    // rather than carrying open ports into a bench that does not match them.
    <CalibrationBenchSession
      key={definition.data.id}
      definition={definition.data}
      onChangeProcedure={() => setDefinitionId(null)}
    />
  );
}
