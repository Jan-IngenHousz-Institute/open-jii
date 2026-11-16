import type {
  PlotAttribute,
  PlotAttributeVersion,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";

/** One version as the plot panel lists it. */
export interface HistoryEntry {
  version: PlotAttributeVersion;
  /** A planned change whose date has not come yet. */
  isUpcoming: boolean;
  /** A later correction replaced it for every moment it covered. */
  isCorrected: boolean;
}

/** An attribute's versions read against today: the value in force, and what came before or comes next. */
export class PlotAttributeHistory {
  readonly name: string;
  readonly entries: readonly HistoryEntry[];

  constructor(attribute: PlotAttribute, today: string) {
    this.name = attribute.name;
    this.entries = attribute.versions.map((version, index) => ({
      version,
      isUpcoming: version.appliesFrom !== null && version.appliesFrom > today,
      isCorrected: (attribute.versions[index - 1]?.correctionReason ?? null) !== null,
    }));
  }

  /** The newest version in force today that no correction replaced. */
  get current(): HistoryEntry | undefined {
    return this.entries.find((entry) => !entry.isUpcoming && !entry.isCorrected);
  }

  /** Every other version, newest first, upcoming ones included. */
  get others(): HistoryEntry[] {
    const current = this.current;
    return this.entries.filter((entry) => entry !== current);
  }
}
