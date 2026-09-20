"use client";

import { OPEN_CALIBRATION_CREATE_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { OverviewTable } from "@/components/overview-table/overview-table";
import { OverviewToolbar } from "@/components/overview-toolbar";
import { useAllCalibrationDefinitions } from "@/hooks/iot/useAllCalibrationDefinitions/useAllCalibrationDefinitions";
import { useCreateCalibrationDefinition } from "@/hooks/iot/useCreateCalibrationDefinition/useCreateCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { zCalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";
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
  const router = useRouter();
  const [family, setFamily] = useState<CalibrationFamily | typeof ALL_FAMILIES>(ALL_FAMILIES);
  const [search, setSearch] = useState("");

  const definitions = useAllCalibrationDefinitions();
  const { mutate: create, isPending: isCreating } = useCreateCalibrationDefinition({
    onSuccess: (definition) => {
      router.push(`/${locale}/platform/calibrations/${definition.id}`);
    },
  });

  // Named and given a family on its own page like everything else, so creating one is a
  // single click rather than a form standing between the author and the thing.
  const createDefinition = useCallback(() => {
    if (isCreating) return;
    const taken = (definitions.data ?? []).map((definition) => definition.name);
    create({ ...starterDefinition("minipar"), name: untitledCalibrationName(taken) });
  }, [create, definitions.data, isCreating]);

  // The create action sits in the page header, as on every library page, and reaches
  // this list as an event.
  useEffect(() => {
    window.addEventListener(OPEN_CALIBRATION_CREATE_EVENT, createDefinition);
    return () => window.removeEventListener(OPEN_CALIBRATION_CREATE_EVENT, createDefinition);
  }, [createDefinition]);

  const needle = search.trim().toLowerCase();
  const hasSearch = needle !== "";

  function matchesSearch(name: string, description: string | null) {
    return (
      !hasSearch ||
      name.toLowerCase().includes(needle) ||
      (description ?? "").toLowerCase().includes(needle)
    );
  }

  // Left undefined while the list is unread, so a failure reaches the table as an error
  // rather than as an empty library.
  const visible = definitions.data?.filter(
    (definition) =>
      (family === ALL_FAMILIES || definition.family === family) &&
      matchesSearch(definition.name, definition.description),
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
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("iot.calibration.library.searchPlaceholder")}
            clearLabel={t("iot.calibration.library.clearSearch")}
            className="md:w-55 w-full"
          />
        }
        filters={
          <Select value={family} onValueChange={handleFamilyChange}>
            <SelectTrigger className="md:w-50 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FAMILIES}>
                {t("iot.calibration.library.allFamilies")}
              </SelectItem>
              {zCalibrationFamily.options.map(renderFamilyOption)}
            </SelectContent>
          </Select>
        }
      />

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
        emptyMessage={t(
          hasSearch ? "iot.calibration.library.noMatches" : "iot.calibration.library.empty",
        )}
      />
    </div>
  );
}
