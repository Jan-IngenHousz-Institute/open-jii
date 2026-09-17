"use client";

import { OwningOrganizationField } from "@/components/organizations/owning-organization-field";
import { DetailsSidebarCard } from "@/components/shared/details-sidebar-card";
import { ResourcePublishControl } from "@/components/visibility/resource-publish-control";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { formatDate } from "@/util/date";
import { useId, useState } from "react";
import { parseApiError } from "~/util/apiError";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import type {
  CalibrationDefinitionDetail,
  CalibrationFamily,
  UpdateCalibrationDefinitionBody,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zCalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

/** Families disagree on shape: "1.03" and "1.1.3" are both whole versions. */
const FIRMWARE_PATTERN = /^\d+(\.\d+){1,2}$/;

interface CalibrationDetailsSidebarProps {
  definitionId: string;
  definition: CalibrationDefinitionDetail;
}

/**
 * What the definition is, beside what it does.
 *
 * The family belongs here rather than in the procedure: it decides which device the
 * platform will let this run against, and with it which instruments, setpoints and
 * writable coefficients everything else is checked against.
 */
export function CalibrationDetailsSidebar({
  definitionId,
  definition,
}: CalibrationDetailsSidebarProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: update, isPending: isUpdating } =
    useUpdateCalibrationDefinition(definitionId);

  const familyId = useId();
  const firmwareId = useId();
  const [firmware, setFirmware] = useState(definition.minFirmwareVersion ?? "");

  // Capability, not ownership: publishing is manage, moving it out is transfer.
  const { canUpdate, canManage, canTransfer } = definition.capabilities;
  const isFirmwareMalformed = firmware !== "" && !FIRMWARE_PATTERN.test(firmware);

  async function save(changes: UpdateCalibrationDefinitionBody) {
    try {
      await update({ definitionId, ...changes });
      toast({ description: t("iot.calibration.sidebar.saved") });
    } catch (error) {
      toast({ description: parseApiError(error)?.message, variant: "destructive" });
    }
  }

  function handleFamilyChange(value: string) {
    // Parsed, not cast: the select lists the families a calibration can name.
    void save({ family: zCalibrationFamily.parse(value) });
  }

  function handleFirmwareBlur() {
    const next = firmware === "" ? null : firmware;
    if (isFirmwareMalformed || next === definition.minFirmwareVersion) {
      return;
    }

    void save({ minFirmwareVersion: next });
  }

  function renderFamilyOption(family: CalibrationFamily) {
    return (
      <SelectItem key={family} value={family}>
        {getSensorFamilyLabel(family)}
      </SelectItem>
    );
  }

  return (
    <DetailsSidebarCard
      title={t("iot.calibration.sidebar.title")}
      collapsedSummary={`${tCommon("common.updated")} ${formatDate(definition.updatedAt)}`}
    >
      <div className="space-y-1">
        <Label htmlFor={familyId}>{t("iot.calibration.sidebar.family")}</Label>
        {canUpdate ? (
          <Select
            value={definition.family}
            onValueChange={handleFamilyChange}
            disabled={isUpdating}
          >
            <SelectTrigger id={familyId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{zCalibrationFamily.options.map(renderFamilyOption)}</SelectContent>
          </Select>
        ) : (
          <p className="text-muted-foreground text-sm">{getSensorFamilyLabel(definition.family)}</p>
        )}
        <p className="text-muted-foreground text-xs">{t("iot.calibration.sidebar.familyHint")}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={firmwareId}>{t("iot.calibration.sidebar.firmware")}</Label>
        <Input
          id={firmwareId}
          value={firmware}
          onChange={(event) => setFirmware(event.target.value)}
          onBlur={handleFirmwareBlur}
          disabled={!canUpdate || isUpdating}
          placeholder={t("iot.calibration.sidebar.firmwarePlaceholder")}
          aria-invalid={isFirmwareMalformed}
          className="font-mono"
        />
        <p
          className={
            isFirmwareMalformed ? "text-destructive text-xs" : "text-muted-foreground text-xs"
          }
        >
          {isFirmwareMalformed
            ? t("iot.calibration.sidebar.firmwareInvalid")
            : t("iot.calibration.sidebar.firmwareHint")}
        </p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.created")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(definition.createdAt)}</p>
      </div>

      <OwningOrganizationField
        resourceType="calibration_definition"
        resourceId={definitionId}
        organizationId={definition.organizationId}
        organizationName={definition.organizationName}
        canTransfer={canTransfer}
      />

      {/* Visibility and the one-way publish action. A method other labs can copy is the
          point of writing one down. */}
      <ResourcePublishControl
        resourceType="calibration_definition"
        resourceId={definitionId}
        visibility={definition.visibility}
        canManage={canManage}
      />

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.updated")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(definition.updatedAt)}</p>
      </div>
    </DetailsSidebarCard>
  );
}
