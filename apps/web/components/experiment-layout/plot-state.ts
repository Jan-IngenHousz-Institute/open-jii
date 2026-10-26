/**
 * The one plot-state legend every grid draws, on the Layout tab and in the app. Fill carries a
 * category (treatment by default) with a one-letter code, border carries a measurer's share, a
 * glyph carries state, dimming means only "not yours", a gap is an empty dotted cell, and a plot
 * removed after it was measured shows a cross.
 */

/** The states a glyph marks, in the order the legend lists them. */
export const PLOT_MARKS = [
  "measured",
  "skipped",
  "current",
  "measuredTwice",
  "flagged",
  "uploadFailed",
  "outsideShare",
] as const;

export type PlotMark = (typeof PLOT_MARKS)[number];

/** What one grid position holds. */
export type PlotCellKind = "plot" | "gap" | "removed";

/** A legend line beyond the categories and shares. */
export type PlotLegendEntry = PlotMark | "notYours" | "gap" | "removed";

export interface PlotCategory {
  value: string;
  code: string;
  /** Null past the palette's length, where the code alone carries the value. */
  fillClassName: string | null;
}

export interface PlotShare {
  name: string;
  initials: string;
  borderClassName: string;
}

// The platform chart palette, leaving out the primary teal that marks a selection and a share.
const CATEGORY_FILLS = [
  "bg-chart-2/25",
  "bg-chart-4/40",
  "bg-node-question/25",
  "bg-node-measurement/25",
  "bg-node-branch/30",
] as const;

// Hues no category fill uses, so a share border never reads as a treatment.
const SHARE_BORDERS = [
  "border-chart-1",
  "border-node-analysis",
  "border-node-instruction",
  "border-foreground/70",
] as const;

function words(value: string): string[] {
  return value.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * The values a grid's fill encodes, in the order given. Each gets a palette fill while the palette
 * lasts and a one-letter code always, so color is never the only carrier.
 */
export class PlotCategories {
  readonly entries: readonly PlotCategory[];
  private readonly byValue: ReadonlyMap<string, PlotCategory>;

  constructor(values: readonly string[]) {
    const distinct = [...new Set(values)];
    const firstWords = distinct.map((value) => words(value)[0] ?? value);
    const taken = new Set<string>();

    this.entries = distinct.map((value, index) => {
      const sharesFirstWord = firstWords.filter((word) => word === firstWords[index]).length > 1;
      const code = PlotCategories.pickCode(value, sharesFirstWord, taken);
      taken.add(code);
      return { value, code, fillClassName: CATEGORY_FILLS[index] ?? null };
    });
    this.byValue = new Map(this.entries.map((entry) => [entry.value, entry]));
  }

  get(value: string | null | undefined): PlotCategory | undefined {
    return value === null || value === undefined ? undefined : this.byValue.get(value);
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * The first free letter among the value's word initials, then its other characters. Values that
   * share a first word, such as Line A and Line B, are told apart by their last word.
   */
  private static pickCode(value: string, sharesFirstWord: boolean, taken: ReadonlySet<string>) {
    const initials = words(value).map((word) => word.charAt(0));
    const ordered = sharesFirstWord ? [...initials].reverse() : initials;
    const candidates = [...ordered, ...value.replace(/\s+/g, "").split(""), ..."123456789"];
    const free = candidates.map((letter) => letter.toUpperCase()).find((code) => !taken.has(code));
    return free ?? "?";
  }
}

/** The measurers a field is divided between, in share order, each with a border and initials. */
export class PlotShares {
  readonly entries: readonly PlotShare[];

  constructor(names: readonly string[]) {
    this.entries = names.map((name, index) => ({
      name,
      initials: PlotShares.initialsOf(name),
      borderClassName: SHARE_BORDERS[index % SHARE_BORDERS.length] ?? "border-border",
    }));
  }

  at(index: number | null | undefined): PlotShare | undefined {
    return index === null || index === undefined ? undefined : this.entries[index];
  }

  private static initialsOf(name: string): string {
    const parts = words(name);
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? "") : "";
    return `${first}${last}`.toUpperCase();
  }
}
