import type {
  ColumnDescription,
  ColumnDictionary,
  ColumnProducer,
  DictionaryColumn,
  DictionaryGroup,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";

export type DictionaryFilter = "all" | "undescribed" | "suggested";

export interface DictionaryEntry {
  column: DictionaryColumn;
  producer: ColumnProducer;
}

export interface EarlierDescription {
  description: ColumnDescription;
  workbookVersion: number;
}

/** What the Dictionary view derives from the columns an experiment produced. */
export class DictionaryView {
  readonly entries: readonly DictionaryEntry[];

  constructor(private readonly dictionary: ColumnDictionary) {
    this.entries = dictionary.groups.flatMap((group) =>
      group.columns.map((column) => ({ column, producer: group.producer })),
    );
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** The plot column comes from the layout and is never counted. */
  private get countable(): readonly DictionaryEntry[] {
    return this.entries.filter((entry) => entry.producer.kind !== "layout");
  }

  get total(): number {
    return this.countable.length;
  }

  get described(): number {
    return this.countable.filter((entry) => entry.column.description !== null).length;
  }

  get hasSuggestions(): boolean {
    return this.countable.some((entry) => entry.column.isSuggested === true);
  }

  visibleGroups(filter: DictionaryFilter): DictionaryGroup[] {
    return this.dictionary.groups
      .map((group) => ({
        ...group,
        columns: group.columns.filter((column) => this.matches(filter, column, group.producer)),
      }))
      .filter((group) => group.columns.length > 0);
  }

  find(identity: string | null): DictionaryEntry | null {
    return this.entries.find((entry) => entry.column.identity === identity) ?? null;
  }

  /** The same column's description under the workbook's previous version, when it has one. */
  earlierDescription(entry: DictionaryEntry): EarlierDescription | null {
    const earlier = this.find(entry.column.previous ?? null);

    if (earlier?.column.description && earlier.producer.kind === "instrument") {
      return {
        description: earlier.column.description,
        workbookVersion: earlier.producer.workbookVersion,
      };
    }

    return null;
  }

  /** The next column still to work through under the filter, after this one and wrapping round. */
  nextToDo(current: DictionaryEntry, filter: DictionaryFilter): DictionaryEntry | null {
    const toDo = this.entries.filter(
      (entry) =>
        entry.column.identity === current.column.identity ||
        this.isToDo(filter, entry.column, entry.producer),
    );
    const position = toDo.findIndex((entry) => entry.column.identity === current.column.identity);
    const others = [...toDo.slice(position + 1), ...toDo.slice(0, position)];

    return others[0] ?? null;
  }

  firstSuggested(): DictionaryEntry | null {
    return (
      this.entries.find((entry) => this.isToDo("suggested", entry.column, entry.producer)) ?? null
    );
  }

  private matches(
    filter: DictionaryFilter,
    column: DictionaryColumn,
    producer: ColumnProducer,
  ): boolean {
    if (filter === "all") {
      return true;
    }
    return this.isToDo(filter, column, producer);
  }

  private isToDo(
    filter: DictionaryFilter,
    column: DictionaryColumn,
    producer: ColumnProducer,
  ): boolean {
    const isFromLayout = producer.kind === "layout";
    const isUndescribed = column.description === null;

    if (isFromLayout || !isUndescribed) {
      return false;
    }

    return filter === "suggested" ? column.isSuggested === true : true;
  }
}
