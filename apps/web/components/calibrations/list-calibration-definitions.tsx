"use client";

import { OverviewTable } from "@/components/overview-table/overview-table";
import { useAllCalibrationDefinitions } from "@/hooks/iot/useAllCalibrationDefinitions/useAllCalibrationDefinitions";
import { useCreateCalibrationDefinition } from "@/hooks/iot/useCreateCalibrationDefinition/useCreateCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { zCalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { getCalibrationDefinitionColumns } from "./calibration-definition-columns";
import { untitledCalibrationName } from "./starter-definition";
import { starterDefinition } from "./starter-definition";

const ALL_FAMILIES = "all";

/** The bench procedures anyone can run. */
export function ListCalibrationDefinitions() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const [family, setFamily] = useState<CalibrationFamily | typeof ALL_FAMILIES>(ALL_FAMILIES);
  const router = useRouter();

  const definitions = useAllCalibrationDefinitions();
  const { mutate: create, isPending: isCreating } = useCreateCalibrationDefinition({
    onSuccess: (definition) => {
      router.push(`/${locale}/platform/calibrations/${definition.id}`);
    },
  });

  // Named and given a family on its own page like everything else, so creating one is a
  // single click rather than a form standing between the author and the thing.
  function createDefinition() {
    const taken = (definitions.data ?? []).map((definition) => definition.name);
    create({ ...starterDefinition("minipar"), name: untitledCalibrationName(taken) });
  }

  // Left undefined while the list is unread, so a failure reaches the table as an error
  // rather than as an empty library.
  const visible = definitions.data?.filter(
    (definition) => family === ALL_FAMILIES || definition.family === family,
  );

  function renderFamilyOption(option: CalibrationFamily) {
    return (
      <SelectItem key={option} value={option}>
        {getSensorFamilyLabel(option)}
      </SelectItem>
    );
  }

  function handleFamilyChange(value: string) {
    // Parsed, not cast: the select lists the families a calibration can name, plus "all".
    setFamily(value === ALL_FAMILIES ? ALL_FAMILIES : zCalibrationFamily.parse(value));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={family} onValueChange={handleFamilyChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FAMILIES}>{t("iot.calibration.library.allFamilies")}</SelectItem>
            {zCalibrationFamily.options.map(renderFamilyOption)}
          </SelectContent>
        </Select>
        <Button type="button" onClick={createDefinition} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-2 size-4" aria-hidden />
          )}
          {t("iot.calibration.library.create")}
        </Button>
      </div>

      <OverviewTable
        columns={getCalibrationDefinitionColumns(t, locale)}
        items={visible}
        isLoading={definitions.isLoading}
        error={definitions.error}
        onRetry={() => void definitions.refetch()}
        errorMessage={t("iot.calibration.loadError")}
        retryLabel={t("iot.calibration.library.retry")}
        getRowKey={(definition) => definition.id}
        getRowHref={(definition) => `/${locale}/platform/calibrations/${definition.id}`}
        emptyMessage={t("iot.calibration.library.empty")}
      />
    </div>
  );
}
