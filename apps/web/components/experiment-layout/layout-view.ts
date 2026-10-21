/** The Layout tab's three views, in the order the switch shows them. */
export const LAYOUT_VIEWS = ["plots", "walking-order", "field-days"] as const;

export type LayoutView = (typeof LAYOUT_VIEWS)[number];

/** The search parameter that holds the open view, so a link can open one. */
export const LAYOUT_VIEW_PARAM = "view";

export function isLayoutView(value: string | null): value is LayoutView {
  return LAYOUT_VIEWS.some((view) => view === value);
}
