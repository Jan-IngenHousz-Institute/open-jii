import { isRecord } from "./forwarder.js";
import type { CostLabel, CostResultByTime, CostServices, ForwarderDatum } from "./types.js";

/** The only namespace the cost publisher's role may publish into. */
export const COST_NAMESPACE = "OpenJII/Cost";

export const DAILY_COST_METRIC = "DailyCostUsd";
export const WEEKLY_COST_METRIC = "WeeklyCostUsd";
export const MONTH_TO_DATE_COST_METRIC = "MonthToDateCostUsd";
export const PREVIOUS_MONTH_TO_DATE_COST_METRIC = "PreviousMonthToDateCostUsd";
export const PREVIOUS_MONTH_COST_METRIC = "PreviousMonthCostUsd";
export const MONTH_FORECAST_COST_METRIC = "MonthForecastCostUsd";
export const PREVIOUS_MONTH_TAX_AND_FEES_METRIC = "PreviousMonthTaxAndFeesUsd";

export const COST_METRICS = [
  DAILY_COST_METRIC,
  WEEKLY_COST_METRIC,
  MONTH_TO_DATE_COST_METRIC,
  PREVIOUS_MONTH_TO_DATE_COST_METRIC,
  PREVIOUS_MONTH_COST_METRIC,
  MONTH_FORECAST_COST_METRIC,
  PREVIOUS_MONTH_TAX_AND_FEES_METRIC,
];

/** Cost Explorer's unblended cost, the figure its console leads with. */
const COST_MEASURE = "UnblendedCost";
/** The same measure as GetCostForecast spells it; it refuses the other spelling. */
const FORECAST_MEASURE = "UNBLENDED_COST";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The windows one run reports, as UTC midnights with exclusive ends, the way Cost Explorer
 * reads them. Each figure is stamped at its window's end: CloudWatch holds a point stamped a day
 * or more back for two days before it returns it, and a window that closed at midnight lands in
 * exactly one daily or weekly bucket however a dashboard aligns its periods.
 */
export interface CostWindows {
  today: Date;
  /** The latest complete ISO week, to the Monday it closed. */
  weekStart: Date;
  weekEnd: Date;
  /** The month of the latest complete day, which on the 1st is the month just ended. */
  monthStart: Date;
  nextMonthStart: Date;
  previousMonthStart: Date;
  /** The month before, to the same day of the month or its own end. */
  previousMonthToDateEnd: Date;
}

export interface CostRequest {
  TimePeriod: { Start: string; End: string };
  Granularity: "DAILY" | "MONTHLY";
  Metrics: string[];
  GroupBy?: { Type: "DIMENSION"; Key: "SERVICE" }[];
  Filter?: { Dimensions: { Key: "RECORD_TYPE"; Values: string[] } };
}

export interface ForecastRequest {
  TimePeriod: { Start: string; End: string };
  Granularity: "MONTHLY";
  Metric: string;
}

export interface CostRequests {
  usageByService: CostRequest;
  totals: CostRequest;
  /** Null on the 1st, when the month reported is complete and Cost Explorer forecasts only ahead. */
  forecast: ForecastRequest | null;
}

export interface CostReadings {
  now: Date;
  environment: string;
  services: CostServices;
  /** Every page of the usageByService request's results, from the 1st of the month before. */
  usageByService: CostResultByTime[];
  totals: CostResultByTime[];
  /** The month's forecast, actuals included; null when there is none. */
  forecast: number | null;
}

function isLabel(value: unknown): value is CostLabel {
  return isRecord(value) && typeof value.label === "string" && typeof value.category === "string";
}

function isCostServices(value: unknown): value is CostServices {
  return (
    isRecord(value) &&
    Array.isArray(value.categories) &&
    isRecord(value.services) &&
    Object.values(value.services).every(isLabel) &&
    isLabel(value.otherServices) &&
    isRecord(value.databricksComponents)
  );
}

/** `docs/monitoring/cost-services.json`, checked, since a misspelt key would label nothing. */
export function parseCostServices(source: string): CostServices {
  const parsed: unknown = JSON.parse(source);
  if (!isCostServices(parsed)) {
    throw new Error("cost-services.json does not have the shape the publisher reads");
  }
  return parsed;
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}

/** Cost Explorer's date format. */
export function costDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function costWindows(now: Date): CostWindows {
  const today = utcDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const weekEnd = addDays(today, -daysSinceMonday);
  const yesterday = addDays(today, -1);
  const year = yesterday.getUTCFullYear();
  const month = yesterday.getUTCMonth();
  const previousMonthStart = utcDay(year, month - 1, 1);
  const monthStart = utcDay(year, month, 1);

  return {
    today,
    weekStart: addDays(weekEnd, -7),
    weekEnd,
    monthStart,
    nextMonthStart: utcDay(year, month + 1, 1),
    previousMonthStart,
    previousMonthToDateEnd: new Date(
      Math.min(addDays(previousMonthStart, yesterday.getUTCDate()).getTime(), monthStart.getTime()),
    ),
  };
}

export function costRequests(now: Date): CostRequests {
  const windows = costWindows(now);
  const monthRunning = windows.nextMonthStart.getTime() > windows.today.getTime();

  return {
    usageByService: {
      TimePeriod: { Start: costDate(windows.previousMonthStart), End: costDate(windows.today) },
      Granularity: "DAILY",
      Metrics: [COST_MEASURE],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      Filter: { Dimensions: { Key: "RECORD_TYPE", Values: ["Usage"] } },
    },
    totals: {
      TimePeriod: { Start: costDate(windows.previousMonthStart), End: costDate(windows.today) },
      Granularity: "DAILY",
      Metrics: [COST_MEASURE],
    },
    forecast: monthRunning
      ? {
          TimePeriod: { Start: costDate(windows.today), End: costDate(windows.nextMonthStart) },
          Granularity: "MONTHLY",
          Metric: FORECAST_MEASURE,
        }
      : null,
  };
}

function amount(metrics: Record<string, { Amount?: string }> | undefined): number {
  const value = Number(metrics?.[COST_MEASURE]?.Amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** CloudWatch keeps a negative zero, which Grafana stacks downwards from the axis. */
function cents(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

/** Every label the publisher reports, so a service that spent nothing reads zero, not a gap. */
function serviceLabels(services: CostServices): CostLabel[] {
  const labels = [...Object.values(services.services), services.otherServices];
  return [...new Map(labels.map((label) => [label.label, label])).values()];
}

function usageByDay(
  results: CostResultByTime[],
  services: CostServices,
): Map<string, Map<string, number>> {
  const byDay = new Map<string, Map<string, number>>();

  for (const result of results) {
    const day = result.TimePeriod?.Start ?? "";
    const byLabel = byDay.get(day) ?? new Map<string, number>();

    for (const group of result.Groups ?? []) {
      const service = group.Keys?.[0] ?? "";
      const { label } = services.services[service] ?? services.otherServices;
      byLabel.set(label, (byLabel.get(label) ?? 0) + amount(group.Metrics));
    }

    byDay.set(day, byLabel);
  }

  return byDay;
}

function totalByDay(results: CostResultByTime[]): Map<string, number> {
  return new Map(results.map((result) => [result.TimePeriod?.Start ?? "", amount(result.Total)]));
}

function daysBetween(start: Date, end: Date): string[] {
  const days: string[] = [];
  for (let at = start; at.getTime() < end.getTime(); at = addDays(at, 1)) {
    days.push(costDate(at));
  }
  return days;
}

/** The datapoints one run publishes, each stamped at the end of the window it covers. */
export function costDatums(readings: CostReadings): ForwarderDatum[] {
  const windows = costWindows(readings.now);
  const usage = usageByDay(readings.usageByService, readings.services);
  const totals = totalByDay(readings.totals);
  const labels = serviceLabels(readings.services);

  const point = (metric: string, value: number, at: Date, service?: CostLabel): ForwarderDatum => ({
    namespace: COST_NAMESPACE,
    datum: {
      MetricName: metric,
      Value: cents(value),
      Unit: "None",
      Timestamp: at,
      Dimensions: [
        { Name: "Environment", Value: readings.environment },
        ...(service === undefined
          ? []
          : [
              { Name: "Category", Value: service.category },
              { Name: "Service", Value: service.label },
            ]),
      ],
    },
  });

  const usageOver = (label: string, days: string[]) =>
    days.reduce((sum, day) => sum + (usage.get(day)?.get(label) ?? 0), 0);
  const allUsageOver = (days: string[]) =>
    labels.reduce((sum, service) => sum + usageOver(service.label, days), 0);
  const totalOver = (days: string[]) => days.reduce((sum, day) => sum + (totals.get(day) ?? 0), 0);

  // Yesterday, then the day before again, since Cost Explorer is still adding to it.
  const daily = [1, 2].flatMap((daysBack) => {
    const day = costDate(addDays(windows.today, -daysBack));
    const end = addDays(windows.today, 1 - daysBack);
    return labels.map((service) =>
      point(DAILY_COST_METRIC, usageOver(service.label, [day]), end, service),
    );
  });

  // Usage only: AWS dates a month's tax and fees on the 1st and adds to them all month, so no
  // week would carry its own share.
  const week = daysBetween(windows.weekStart, windows.weekEnd);
  const weekly = labels.map((service) =>
    point(WEEKLY_COST_METRIC, usageOver(service.label, week), windows.weekEnd, service),
  );

  const month = daysBetween(windows.monthStart, windows.today);
  const previousMonth = daysBetween(windows.previousMonthStart, windows.monthStart);
  const previousToDate = daysBetween(windows.previousMonthStart, windows.previousMonthToDateEnd);
  const previousUsage = allUsageOver(previousMonth);

  // This month's tax so far follows its usage so far, while the month before's is already whole,
  // so the month before is compared with its tax in proportion to its usage by the same day.
  const previousMonthToDate =
    previousUsage > 0
      ? (allUsageOver(previousToDate) * totalOver(previousMonth)) / previousUsage
      : totalOver(previousToDate);

  const monthToDate = totalOver(month);
  const monthRunning = windows.nextMonthStart.getTime() > windows.today.getTime();
  const forecast = monthRunning ? readings.forecast : monthToDate;

  const monthly = [
    point(MONTH_TO_DATE_COST_METRIC, monthToDate, windows.today),
    point(PREVIOUS_MONTH_TO_DATE_COST_METRIC, previousMonthToDate, windows.today),
    point(PREVIOUS_MONTH_COST_METRIC, totalOver(previousMonth), windows.today),
    point(
      PREVIOUS_MONTH_TAX_AND_FEES_METRIC,
      totalOver(previousMonth) - previousUsage,
      windows.today,
    ),
    ...(forecast === null ? [] : [point(MONTH_FORECAST_COST_METRIC, forecast, windows.today)]),
  ];

  return [...daily, ...weekly, ...monthly];
}
