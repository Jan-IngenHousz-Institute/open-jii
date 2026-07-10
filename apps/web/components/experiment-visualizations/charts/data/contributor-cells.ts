// CONTRIBUTOR columns come back as STRUCT<id, name, avatar> JSON strings.
// Charts group and colour by the display name, so both the data hook and the
// colour-map picker flatten each cell through this one converter to stay aligned.

const UNKNOWN_CONTRIBUTOR = "Unknown";

export function contributorDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return UNKNOWN_CONTRIBUTOR;
  }
  try {
    const parsed = JSON.parse(value) as { name?: unknown };
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    return name.length > 0 ? name : UNKNOWN_CONTRIBUTOR;
  } catch {
    return UNKNOWN_CONTRIBUTOR;
  }
}
