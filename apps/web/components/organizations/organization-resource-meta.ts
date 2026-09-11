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
};
