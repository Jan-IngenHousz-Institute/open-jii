import { compactTimestamp, parseDatabricksTimestamp } from "../../common/utils/datetime";

const MAX_SEGMENT_LENGTH = 60;

/** Latin letters NFKD leaves whole (sharp s, o-slash, l-stroke, ligatures, eth, thorn). */
const TRANSLITERATIONS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  ð: "d",
  ø: "o",
  þ: "th",
  đ: "d",
  ł: "l",
  œ: "oe",
};

const UNDECOMPOSED = /[ßæðøþđłœ]/g;

/** Keeps accented experiment names legible instead of slugging letters to hyphens. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(UNDECOMPOSED, (letter) => TRANSLITERATIONS[letter] ?? "-")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SEGMENT_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/**
 * Extension from the basename only, so a dot in a parent directory cannot leak in. A gzipped
 * part keeps the extension of what it holds, as in `.csv.gz`.
 */
function extensionOf(filePath: string): string {
  const fileName = filePath.split("/").pop() ?? "";
  const match = /(?:\.[a-z0-9]{1,10})?\.gz$/i.exec(fileName) ?? /\.[a-z0-9]{1,10}$/i.exec(fileName);
  return match ? match[0].toLowerCase() : "";
}

/** `_part-03-of-12`, numbered from one and padded so the parts sort in order. */
function partSuffix(part: { index: number; count: number } | undefined): string {
  if (!part || part.count <= 1) {
    return "";
  }

  const width = String(part.count).length;
  return `_part-${String(part.index + 1).padStart(width, "0")}-of-${part.count}`;
}

/**
 * Human-readable download name: `{experiment}_{table}_{timestamp}.{ext}`, with a part suffix
 * before the extension when the export has more than one part.
 * Each segment degrades to an identifier rather than vanishing when metadata is
 * incomplete. Timestamps are second-precision, so two exports of the same table
 * finishing within a second share a name and the browser suffixes the duplicate.
 */
export function buildExportFilename(params: {
  experimentName: string;
  experimentId: string;
  tableName: string;
  exportId: string;
  filePath: string;
  completedAt: string | null;
  part?: { index: number; count: number };
}): string {
  const { experimentName, experimentId, tableName, exportId, filePath, completedAt, part } = params;

  const segments = [slugify(experimentName) || slugify(experimentId) || "experiment"];

  const table = slugify(tableName);
  if (table) {
    segments.push(table);
  }

  const completedDate = parseDatabricksTimestamp(completedAt);
  segments.push(completedDate ? compactTimestamp(completedDate) : slugify(exportId) || "export");

  return `${segments.join("_")}${partSuffix(part)}${extensionOf(filePath)}`;
}
