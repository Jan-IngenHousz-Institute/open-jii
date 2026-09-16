"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { useAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { StatusBadge } from "@/components/shared/status-badge";
import { ResourceDetailTabs } from "@/components/sharing/resource-detail-tabs";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useUpdateCalibrationDefinition } from "@/hooks/iot/useUpdateCalibrationDefinition/useUpdateCalibrationDefinition";
import { getSensorFamilyBadgeTone, getSensorFamilyLabel } from "@/util/sensor-family";
import { SlidersHorizontal } from "lucide-react";
import { parseApiError } from "~/util/apiError";

import type { CalibrationDefinitionDetail } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { toast } from "@repo/ui/hooks/use-toast";

interface CalibrationLayoutContentProps {
  definitionId: string;
  definition: CalibrationDefinitionDetail;
  children: React.ReactNode;
}

/** The chrome a definition keeps across its routes: its name, what it is for, and saving. */
export function CalibrationLayoutContent({
  definitionId,
  definition,
  children,
}: CalibrationLayoutContentProps) {
  const { mutateAsync: update, isPending: isUpdating } =
    useUpdateCalibrationDefinition(definitionId);
  const autosave = useAutosaveStatus();

  // Capability, not ownership: a "Can edit" grantee renames and edits here too.
  const { canUpdate, canShare, canLeave } = definition.capabilities;
  const indicatorStatus = isUpdating ? "saving" : (autosave?.status ?? "idle");

  const handleTitleSave = async (name: string) => {
    await update(
      { definitionId, name },
      {
        onError: (error) => {
          toast({ description: parseApiError(error)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <InlineEditableTitle
          name={definition.name}
          hasAccess={canUpdate}
          onSave={handleTitleSave}
          isPending={isUpdating}
          icon={<SlidersHorizontal className="h-6 w-6" />}
          badges={
            <>
              <StatusBadge tone={getSensorFamilyBadgeTone(definition.family)}>
                {getSensorFamilyLabel(definition.family)}
              </StatusBadge>
              <VisibilityBadge visibility={definition.visibility} />
            </>
          }
        />
        <AutosaveIndicator status={indicatorStatus} />
      </div>

      <ResourceDetailTabs
        resourceType="calibration_definition"
        resourceId={definitionId}
        canShare={canShare}
        canLeave={canLeave}
      >
        {children}
      </ResourceDetailTabs>
    </div>
  );
}
