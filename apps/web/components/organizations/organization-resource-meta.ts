import type { StatusTone } from "@/components/shared/status-badge";
import { getExperimentStatusBadgeTone } from "@/util/experiment-status";
import { getMacroLanguageBadgeTone, getMacroLanguageLabel } from "@/util/macro-language";
import { getSensorFamilyBadgeTone, getSensorFamilyLabel } from "@/util/sensor-family";

import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import type { MacroLanguage } from "@repo/api/domains/macro/macro.schema";
import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * Where each grantable type's detail page lives on the platform: the resources card
 * links rows here, and so does the team-grants list.
 */
export const RESOURCE_SEGMENT: Record<SharingResourceType, string> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
  device: "devices",
  device_group: "devices/groups",
  calibration_definition: "calibrations",
};

/**
 * The order the types read in: the two things you make, then the two you write, then
 * the hardware. One order for every surface on the organization page — the resources
 * card groups by it, the featured card rotates through it, the estate bar segments by
 * it — so none of them can disagree about which types exist.
 */
export const GROUP_ORDER: readonly SharingResourceType[] = [
  "experiment",
  "protocol",
  "macro",
  "workbook",
  "device",
  "device_group",
  "calibration_definition",
];

/**
 * The colour each type wears as a proportion or a dot. Theme tokens, not hexes, so
 * dark mode comes for free. The set has to separate at 8px, which is what picks the
 * three chart tokens: devices keep a blue (`--chart-3`), macros the bright green
 * (`--chart-2`), and protocols take an amber (`--chart-4`) rather than a green,
 * because a green would sit on the same hue as the macro dot. `--chart-1` is
 * unusable here — it is the same value as `--primary`.
 */
export const RESOURCE_TYPE_COLOR: Record<SharingResourceType, string> = {
  experiment: "bg-primary",
  protocol: "bg-chart-4",
  macro: "bg-chart-2",
  workbook: "bg-accent",
  device: "bg-chart-3",
  device_group: "bg-secondary",
  calibration_definition: "bg-chart-5",
};

/** The fields {@link resourceMetaBadge} reads, per type that has a badge. */
type BadgedResource =
  | { type: "experiment"; status: ExperimentStatus }
  | { type: "protocol"; family: SensorFamily }
  | { type: "macro"; language: MacroLanguage }
  | { type: "device"; deviceType: SensorFamily }
  | { type: "workbook" | "device_group" | "calibration_definition" };

/** A row's one type-specific fact, in the colour that value wears on its own listing. */
export function resourceMetaBadge(
  resource: BadgedResource,
  t: (key: string) => string,
): { label: string; tone: StatusTone } | null {
  switch (resource.type) {
    case "experiment":
      return {
        label: t(`organizations.resources.status.${resource.status}`),
        tone: getExperimentStatusBadgeTone(resource.status),
      };
    case "protocol":
      return {
        label: getSensorFamilyLabel(resource.family),
        tone: getSensorFamilyBadgeTone(resource.family),
      };
    case "macro":
      return {
        label: getMacroLanguageLabel(resource.language),
        tone: getMacroLanguageBadgeTone(resource.language),
      };
    case "device":
      return {
        label: getSensorFamilyLabel(resource.deviceType),
        tone: getSensorFamilyBadgeTone(resource.deviceType),
      };
    // A workbook has no second fact. A group does, its roster size, but that is a
    // quantity rather than a category, so it has no colour of its own to wear and
    // reads as footer text beside the type instead.
    case "workbook":
    case "device_group":
    case "calibration_definition":
      return null;
  }
}
