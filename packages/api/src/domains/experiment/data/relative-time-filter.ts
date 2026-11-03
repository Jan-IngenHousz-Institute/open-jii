import type {
  ExperimentDataFilter,
  ExperimentDataFilterValue,
  ExperimentRelativeTimeWindow,
} from "./experiment-data.schema";

export function isRelativeTimeWindow(
  value: ExperimentDataFilterValue | undefined,
): value is ExperimentRelativeTimeWindow {
  return value !== undefined && typeof value === "object" && !Array.isArray(value);
}

export function hasRelativeTimeFilters(filters: ExperimentDataFilter[] | undefined): boolean {
  return filters?.some((filter) => isRelativeTimeWindow(filter.value)) ?? false;
}

export function relativeTimeFilterIdentity(
  column: string,
  value: ExperimentRelativeTimeWindow,
): string {
  return JSON.stringify([column, value.last, value.unit]);
}

export function relativeTimeFilterIdentities(
  filters: ExperimentDataFilter[] | undefined,
): string[] {
  return (filters ?? []).flatMap((filter) =>
    isRelativeTimeWindow(filter.value)
      ? [relativeTimeFilterIdentity(filter.column, filter.value)]
      : [],
  );
}

export function relativeTimeMinute(now: number): number {
  return Math.floor(now / 60_000) * 60_000;
}

export function resolveRelativeTimeWindow(
  value: ExperimentRelativeTimeWindow,
  now: number,
): [string, string] {
  const end = relativeTimeMinute(now);
  // A rolling day is 24 elapsed hours, including across daylight-saving changes.
  const duration = value.last * (value.unit === "hours" ? 3_600_000 : 86_400_000);
  return [new Date(end - duration).toISOString(), new Date(end).toISOString()];
}

export function resolveRelativeTimeFilters(filters: ExperimentDataFilter[], now: number) {
  return filters.map((filter) => ({
    ...filter,
    value: isRelativeTimeWindow(filter.value)
      ? resolveRelativeTimeWindow(filter.value, now)
      : filter.value,
  }));
}
