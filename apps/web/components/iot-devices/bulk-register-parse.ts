import { zRegisterIotDeviceBody } from "@repo/api/domains/iot/iot.schema";

const zSerialNumber = zRegisterIotDeviceBody.shape.serialNumber;

export type BulkRowStatus = "ready" | "invalid" | "duplicate" | "registered";

export interface BulkRow {
  /** The raw line, for pointing at problems. */
  line: string;
  serialNumber: string;
  name?: string;
  status: BulkRowStatus;
}

export interface BulkBatch {
  rows: BulkRow[];
  counts: Record<BulkRowStatus, number>;
  /** The rows a submit would actually send. */
  ready: { serialNumber: string; name?: string }[];
}

/**
 * One device per non-empty line: a serial, optionally followed by a name after
 * a comma, semicolon, or tab (so manufacturer CSV columns paste directly).
 * Every line is classified instead of one bad line voiding the batch: invalid
 * serials, duplicates within the paste, and serials already in the registry
 * are flagged per row and excluded from the submit.
 */
export function parseBulkBatch(text: string, registeredSerials: Set<string>): BulkBatch {
  const rows: BulkRow[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;

    const separatorAt = firstSeparator(line);
    const serialNumber = (separatorAt === -1 ? line : line.slice(0, separatorAt)).trim();
    const name = separatorAt === -1 ? undefined : line.slice(separatorAt + 1).trim();

    const status: BulkRowStatus = !zSerialNumber.safeParse(serialNumber).success
      ? "invalid"
      : seen.has(serialNumber)
        ? "duplicate"
        : registeredSerials.has(serialNumber)
          ? "registered"
          : "ready";
    if (status !== "invalid") {
      seen.add(serialNumber);
    }

    rows.push(name ? { line, serialNumber, name, status } : { line, serialNumber, status });
  }

  const counts: Record<BulkRowStatus, number> = {
    ready: 0,
    invalid: 0,
    duplicate: 0,
    registered: 0,
  };
  for (const row of rows) {
    counts[row.status] += 1;
  }

  return {
    rows,
    counts,
    ready: rows
      .filter((row) => row.status === "ready")
      .map((row) =>
        row.name
          ? { serialNumber: row.serialNumber, name: row.name }
          : { serialNumber: row.serialNumber },
      ),
  };
}

function firstSeparator(line: string): number {
  const candidates = [line.indexOf(","), line.indexOf(";"), line.indexOf("\t")].filter(
    (index) => index !== -1,
  );
  return candidates.length === 0 ? -1 : Math.min(...candidates);
}
