import { PAGE_BYTE_LIMIT } from "./experiment-data.model";

/**
 * A read's size as one JSON array of rows of cell texts, counted row by row, so a read can stop
 * once it has passed the limit instead of holding the rest of its rows first.
 */
export class PageBytes {
  private bytes = 2;
  private rows = 0;

  static of(rows: (string | null)[][]): PageBytes {
    const size = new PageBytes();
    rows.forEach((row) => size.add(row));
    return size;
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
