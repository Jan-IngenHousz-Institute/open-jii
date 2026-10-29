import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  costDatums,
  costRequests,
  costWindows,
  parseCostServices,
  percentOfSpendLimit,
} from "./cost.js";
import type { CostResultByTime, CostServices, ForwarderDatum } from "./types.js";

const SERVICES: CostServices = {
  categories: [
    { name: "Databricks VMs", colour: "#d95926" },
    { name: "Other AWS", colour: "#d55181" },
  ],
  services: {
    "Amazon Elastic Compute Cloud - Compute": { label: "EC2 compute", category: "Databricks VMs" },
    "Amazon Simple Storage Service": { label: "S3", category: "Other AWS" },
    "Amazon Managed Grafana": { label: "Grafana", category: "Other AWS", billsMonthly: true },
  },
  otherServices: { label: "Other AWS services", category: "Other AWS" },
  databricksComponents: {},
};

// A Tuesday, so the latest complete week is 19 to 25 October.
const RUN = new Date("2026-10-27T06:00:00Z");

function day(date: string, groups: Record<string, number>): CostResultByTime {
  return {
    TimePeriod: { Start: date },
    Groups: Object.entries(groups).map(([service, usd]) => ({
      Keys: [service],
      Metrics: { UnblendedCost: { Amount: String(usd) } },
    })),
  };
}

function total(date: string, usd: number): CostResultByTime {
  return { TimePeriod: { Start: date }, Total: { UnblendedCost: { Amount: String(usd) } } };
}

function dates(from: string, count: number): string[] {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function find(datums: ForwarderDatum[], metric: string, service?: string) {
  return datums.filter(
    ({ datum }) =>
      datum.MetricName === metric &&
      datum.Dimensions.find(({ Name }) => Name === "Service")?.Value === service,
  );
}

describe("costWindows", () => {
  it("reports the latest complete ISO week and the month of the latest complete day", () => {
    const windows = costWindows(RUN);

    expect(windows.today.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(windows.weekStart.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(windows.weekEnd.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(windows.monthStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(windows.nextMonthStart.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(windows.previousMonthStart.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // 1 to 26 October against 1 to 26 September.
    expect(windows.previousMonthToDateEnd.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("closes the week on the Monday itself", () => {
    const windows = costWindows(new Date("2026-10-26T06:00:00Z"));

    expect(windows.weekStart.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(windows.weekEnd.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("reports the month just ended on the 1st, against the whole month before it", () => {
    const windows = costWindows(new Date("2026-11-01T06:00:00Z"));

    expect(windows.monthStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(windows.nextMonthStart.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(windows.previousMonthToDateEnd.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("stops the month before at its own end when it is shorter", () => {
    const windows = costWindows(new Date("2027-03-31T06:00:00Z"));

    expect(windows.previousMonthStart.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(windows.previousMonthToDateEnd.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });
});

describe("costRequests", () => {
  it("asks for usage by service and every record type since the 1st of the month before", () => {
    const requests = costRequests(RUN);

    expect(requests.usageByService).toMatchObject({
      TimePeriod: { Start: "2026-09-01", End: "2026-10-27" },
      Granularity: "DAILY",
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      Filter: { Dimensions: { Key: "RECORD_TYPE", Values: ["Usage"] } },
    });
    expect(requests.totals).toMatchObject({
      TimePeriod: { Start: "2026-09-01", End: "2026-10-27" },
      Granularity: "DAILY",
    });
    expect(requests.totals.GroupBy).toBeUndefined();
    expect(requests.forecast).toMatchObject({
      TimePeriod: { Start: "2026-10-27", End: "2026-11-01" },
      Granularity: "MONTHLY",
    });
    // The two APIs spell the same measure differently, and each refuses the other's spelling.
    expect(requests.usageByService.Metrics).toEqual(["UnblendedCost"]);
    expect(requests.forecast?.Metric).toBe("UNBLENDED_COST");
  });

  it("asks for no forecast on the 1st, since Cost Explorer only forecasts ahead", () => {
    expect(costRequests(new Date("2026-11-01T06:00:00Z")).forecast).toBeNull();
  });
});

describe("costDatums", () => {
  // 11.5 of usage a day, 20 rather than 10 of EC2 on the 26th, and 5 of tax dated each 1st.
  const days = [...dates("2026-09-01", 30), ...dates("2026-10-01", 26)];
  const usageOn = (date: string) => ({
    "Amazon Elastic Compute Cloud - Compute": date === "2026-10-26" ? 20 : 10,
    "Amazon Simple Storage Service": 1,
    "AWS Glue": 0.5,
  });
  const usageByService = days.map((date) => day(date, usageOn(date)));
  const totals = days.map((date) =>
    total(
      date,
      Object.values(usageOn(date)).reduce((sum, usd) => sum + usd, 0) +
        (date.endsWith("-01") ? 5 : 0),
    ),
  );
  const readings = {
    now: RUN,
    environment: "dev",
    services: SERVICES,
    usageByService,
    totals,
    forecast: 400,
  };
  const value = (datums: ForwarderDatum[], metric: string, service?: string) =>
    find(datums, metric, service)[0].datum.Value;

  it("publishes yesterday per service, stamped when the day closed, with its category", () => {
    const [yesterday] = find(costDatums(readings), "DailyCostUsd", "EC2 compute");

    expect(yesterday.namespace).toBe("OpenJII/Cost");
    expect(yesterday.datum).toMatchObject({
      Value: 20,
      Unit: "None",
      Dimensions: [
        { Name: "Environment", Value: "dev" },
        { Name: "Category", Value: "Databricks VMs" },
        { Name: "Service", Value: "EC2 compute" },
      ],
    });
    expect(yesterday.datum.Timestamp.toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  it("publishes the day before again, at its own close, so a late revision lands", () => {
    const [, dayBefore] = find(costDatums(readings), "DailyCostUsd", "EC2 compute");

    expect(dayBefore.datum.Value).toBe(10);
    expect(dayBefore.datum.Timestamp.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("counts a service the file does not list under other services", () => {
    expect(value(costDatums(readings), "DailyCostUsd", "Other AWS services")).toBe(0.5);
  });

  it("reads zero for a listed service that spent nothing, rather than leaving a gap", () => {
    const quiet = costDatums({ ...readings, usageByService: [day("2026-10-26", {})] });

    expect(value(quiet, "DailyCostUsd", "S3")).toBe(0);
  });

  it("adds each service's ISO week up, stamped the Monday it closed", () => {
    const [week] = find(costDatums(readings), "WeeklyCostUsd", "EC2 compute");

    // 19 to 25 October; the 20 on the 26th belongs to the next week.
    expect(week.datum.Value).toBe(70);
    expect(week.datum.Timestamp.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("publishes yesterday as a share of its limit, stamped when the day closed", () => {
    const [limit] = find(costDatums(readings), "DailyCostPercentOfLimit", "EC2 compute");

    // 20 yesterday against a usual 10: twice the usual, which the floor also allows, is 20.
    expect(limit.datum.Value).toBe(100);
    expect(limit.datum.Timestamp.toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  it("leaves a service billed monthly out of the spend limit, but not out of its costs", () => {
    const datums = costDatums(readings);

    expect(find(datums, "DailyCostPercentOfLimit", "Grafana")).toEqual([]);
    expect(find(datums, "DailyCostUsd", "Grafana")).toHaveLength(2);
  });

  it("keeps tax and fees out of the week, since AWS dates a month's on its 1st", () => {
    const weekly = costDatums(readings).filter(({ datum }) => datum.MetricName === "WeeklyCostUsd");

    expect(weekly.map(({ datum }) => datum.Dimensions[2].Value)).toEqual([
      "EC2 compute",
      "S3",
      "Grafana",
      "Other AWS services",
    ]);
  });

  it("publishes the month so far, the whole month before, and that month's tax and fees", () => {
    const datums = costDatums(readings);

    // 25 days of 11.5 and one of 21.5, with 5 of tax on the 1st.
    expect(value(datums, "MonthToDateCostUsd")).toBe(314);
    expect(value(datums, "PreviousMonthCostUsd")).toBe(350);
    expect(value(datums, "PreviousMonthTaxAndFeesUsd")).toBe(5);
    expect(value(datums, "MonthForecastCostUsd")).toBe(400);
    expect(find(datums, "MonthToDateCostUsd")[0].datum.Dimensions).toEqual([
      { Name: "Environment", Value: "dev" },
    ]);
    expect(find(datums, "MonthToDateCostUsd")[0].datum.Timestamp.toISOString()).toBe(
      "2026-10-27T00:00:00.000Z",
    );
  });

  it("compares the month before with its tax in proportion to its usage by the same day", () => {
    // AWS dates September's tax on the 1st and grows it all month, so 1 to 26 September carries
    // the whole month's 5 while 1 to 26 October carries only what October has accrued. Prorated:
    // 299 of usage, at September's 350 billed for 345 of usage.
    expect(value(costDatums(readings), "PreviousMonthToDateCostUsd")).toBe(303.33);
  });

  it("falls back to what the month before cost by the same day when it has no usage", () => {
    const datums = costDatums({
      ...readings,
      usageByService: usageByService.filter(({ TimePeriod }) =>
        TimePeriod?.Start?.startsWith("2026-10"),
      ),
    });

    // 25 days of 11.5 and the 1st's 16.5.
    expect(value(datums, "PreviousMonthToDateCostUsd")).toBe(304);
  });

  it("never publishes a negative zero, which Grafana stacks below the axis", () => {
    // A month billed a tenth of a cent under its usage leaves -0.001 of tax, which rounds to -0.
    const rounding = costDatums({
      ...readings,
      totals: totals.map((result) =>
        result.TimePeriod?.Start === "2026-09-01" ? total("2026-09-01", 11.499) : result,
      ),
    });
    const tax = value(rounding, "PreviousMonthTaxAndFeesUsd");

    expect(Object.is(tax, -0)).toBe(false);
    expect(tax).toBe(0);
  });

  it("leaves the forecast out when Cost Explorer has none", () => {
    const datums = costDatums({ ...readings, forecast: null });

    expect(find(datums, "MonthForecastCostUsd")).toEqual([]);
  });

  it("forecasts a complete month as what it cost", () => {
    const datums = costDatums({
      ...readings,
      now: new Date("2026-10-01T06:00:00Z"),
      forecast: null,
    });

    // September in full: 30 days of 11.5, with 5 of tax on the 1st.
    expect(value(datums, "MonthForecastCostUsd")).toBe(350);
  });
});

describe("percentOfSpendLimit", () => {
  it("sets the limit at twice the usual day, the usual being the median", () => {
    // One spike in the history moves a mean but not the median.
    const history = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 300];

    expect(percentOfSpendLimit(90, history)).toBe(150);
  });

  it("raises the limit to the floor above a service that usually costs little", () => {
    // Twice 2 is 4, but the limit is at least 10 above the usual: 12.
    expect(percentOfSpendLimit(6, Array<number>(14).fill(2))).toBe(50);
  });

  it("takes the middle two's mean for an even count", () => {
    expect(percentOfSpendLimit(40, [10, 10, 30, 30])).toBe(100);
  });

  it("counts a service with no history against the floor alone", () => {
    expect(percentOfSpendLimit(15, Array<number>(14).fill(0))).toBe(150);
  });
});

describe("the category file", () => {
  const services = parseCostServices(
    readFileSync(
      join(resolve(__dirname, "../../.."), "docs/monitoring/cost-services.json"),
      "utf8",
    ),
  );
  const categories = services.categories.map(({ name }) => name);
  const labels = [...Object.values(services.services), services.otherServices];

  it("puts every service in a category the dashboards colour", () => {
    expect(labels.filter(({ category }) => !categories.includes(category))).toEqual([]);
    expect(services.categories.filter(({ colour }) => !/^#[0-9a-f]{6}$/.test(colour))).toEqual([]);
  });

  it("gives every service its own label, since the label is the series' dimension", () => {
    const names = labels.map(({ label }) => label);

    expect(new Set(names).size).toBe(names.length);
  });
});
