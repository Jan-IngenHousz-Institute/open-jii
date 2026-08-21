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
 * The colour each type wears as a proportion or a dot. Theme tokens, not hexes: the
 * four the design specifies are already these tokens' light-mode values, so naming
 * them gets dark mode for nothing. Devices take `--highlight` as the only token that
 * separates cleanly from a teal, two greens and a blue at 8px.
 */
export const RESOURCE_TYPE_COLOR: Record<SharingResourceType, string> = {
  experiment: "bg-primary",
  protocol: "bg-tertiary",
  macro: "bg-sidebar-primary",
  workbook: "bg-accent",
  device: "bg-highlight",
  device_group: "bg-secondary",
};
