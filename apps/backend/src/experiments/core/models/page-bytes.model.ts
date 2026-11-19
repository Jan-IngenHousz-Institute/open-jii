import { PAGE_BYTE_LIMIT } from "./experiment-data.model";

/**
 * A read's size as one JSON array of rows of cell texts, counted row by row, so a read can stop
 * once it has passed the limit instead of holding the rest of its rows first.
 */
export class PageBytes {
  private bytes = 2;
  private rows = 0;

  /** The leading rows that fit the limit, as the warehouse returns a read it cut short. */
  static fitting(rows: (string | null)[][]): (string | null)[][] {
    const size = new PageBytes();
    const firstOver = rows.findIndex((row) => {
      size.add(row);
      return size.exceedsLimit;
    });
    return firstOver === -1 ? rows : rows.slice(0, firstOver);
  }

  add(row: (string | null)[]): void {
    const cells = row.reduce(
      (sum, cell) => sum + (cell === null ? 4 : Buffer.byteLength(JSON.stringify(cell))),
      0,
    );
    const separators = (this.rows > 0 ? 1 : 0) + Math.max(row.length - 1, 0);
    this.bytes += 2 + cells + separators;
    this.rows += 1;
  }

  get exceedsLimit(): boolean {
    return this.bytes > PAGE_BYTE_LIMIT;
  }
}
