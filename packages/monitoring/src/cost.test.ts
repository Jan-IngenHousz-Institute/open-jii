import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { costDatums, costRequests, costWindows, parseCostServices } from "./cost.js";
import type { CostResultByTime, CostServices, ForwarderDatum } from "./types.js";

const SERVICES: CostServices = {
  categories: [
    { name: "Databricks VMs", colour: "#d95926" },
    { name: "Other AWS", colour: "#d55181" },
    { name: "Tax and fees", colour: "#898781" },
  ],
  services: {
    "Amazon Elastic Compute Cloud - Compute": { label: "EC2 compute", category: "Databricks VMs" },
    "Amazon Simple Storage Service": { label: "S3", category: "Other AWS" },
  },
  otherServices: { label: "Other AWS services", category: "Other AWS" },
  taxAndFees: { label: "Tax and fees", category: "Tax and fees" },
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
  it("asks for usage by service over the week and every record type since the month before", () => {
    const requests = costRequests(RUN);

    expect(requests.usageByService).toMatchObject({
      TimePeriod: { Start: "2026-10-19", End: "2026-10-27" },
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
  });

  it("asks for no forecast on the 1st, since Cost Explorer only forecasts ahead", () => {
    expect(costRequests(new Date("2026-11-01T06:00:00Z")).forecast).toBeNull();
  });
});

describe("costDatums", () => {
  const usageByService = dates("2026-10-19", 8).map((date) =>
    day(date, {
      "Amazon Elastic Compute Cloud - Compute": date === "2026-10-26" ? 20 : 10,
      "Amazon Simple Storage Service": 1,
      "AWS Glue": 0.5,
    }),
  );
  // 11.5 of usage a day, plus 5 of tax on the 1st of each month.
  const totals = [
    ...dates("2026-09-01", 30).map((date) => total(date, date.endsWith("-01") ? 16.5 : 11.5)),
    ...dates("2026-10-01", 26).map((date) => total(date, date.endsWith("-01") ? 16.5 : 11.5)),
  ];
  const readings = {
    now: RUN,
    environment: "dev",
    services: SERVICES,
    usageByService,
    totals,
    forecast: 400,
  };

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
    const [other] = find(costDatums(readings), "DailyCostUsd", "Other AWS services");

    expect(other.datum.Value).toBe(0.5);
  });

  it("reads zero for a listed service that spent nothing, rather than leaving a gap", () => {
    const quiet = costDatums({ ...readings, usageByService: [day("2026-10-26", {})] });

    expect(find(quiet, "DailyCostUsd", "S3")[0].datum.Value).toBe(0);
  });

  it("adds each service's ISO week up, stamped the Monday it closed", () => {
    const [week] = find(costDatums(readings), "WeeklyCostUsd", "EC2 compute");

    // 19 to 25 October; the 20 on the 26th belongs to the next week.
    expect(week.datum.Value).toBe(70);
    expect(week.datum.Timestamp.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("counts what the week cost beyond usage as tax and fees", () => {
    const withTax = costDatums({
      ...readings,
      totals: [
        ...totals.filter(({ TimePeriod }) => TimePeriod?.Start !== "2026-10-20"),
        total("2026-10-20", 31.5),
      ],
    });

    expect(find(withTax, "WeeklyCostUsd", "Tax and fees")[0].datum).toMatchObject({
      Value: 20,
      Dimensions: [
        { Name: "Environment", Value: "dev" },
        { Name: "Category", Value: "Tax and fees" },
        { Name: "Service", Value: "Tax and fees" },
      ],
    });
  });

  it("never publishes a negative zero, which Grafana stacks below the axis", () => {
    // A total a tenth of a cent under its usage rounds to -0.
    const rounding = costDatums({
      ...readings,
      totals: [
        ...totals.filter(({ TimePeriod }) => TimePeriod?.Start !== "2026-10-21"),
        total("2026-10-21", 11.499),
      ],
    });
    const [tax] = find(rounding, "WeeklyCostUsd", "Tax and fees");

    expect(Object.is(tax.datum.Value, -0)).toBe(false);
    expect(tax.datum.Value).toBe(0);
  });

  it("publishes the month so far against the same point and the whole of the month before", () => {
    const monthly = Object.fromEntries(
      find(costDatums(readings), "MonthToDateCostUsd")
        .concat(find(costDatums(readings), "PreviousMonthToDateCostUsd"))
        .concat(find(costDatums(readings), "PreviousMonthCostUsd"))
        .concat(find(costDatums(readings), "MonthForecastCostUsd"))
        .map(({ datum }) => [datum.MetricName, datum]),
    );

    // 26 days of 11.5, with 5 of tax on the 1st.
    expect(monthly.MonthToDateCostUsd.Value).toBe(304);
    expect(monthly.PreviousMonthToDateCostUsd.Value).toBe(304);
    expect(monthly.PreviousMonthCostUsd.Value).toBe(350);
    expect(monthly.MonthForecastCostUsd.Value).toBe(400);
    expect(monthly.MonthToDateCostUsd.Dimensions).toEqual([{ Name: "Environment", Value: "dev" }]);
    expect(monthly.MonthToDateCostUsd.Timestamp.toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  it("leaves the forecast out when Cost Explorer has none", () => {
    const datums = costDatums({ ...readings, forecast: null });

    expect(datums.some(({ datum }) => datum.MetricName === "MonthForecastCostUsd")).toBe(false);
  });

  it("forecasts a complete month as what it cost", () => {
    const datums = costDatums({
      ...readings,
      now: new Date("2026-10-01T06:00:00Z"),
      forecast: null,
    });
    const [forecast] = datums.filter(({ datum }) => datum.MetricName === "MonthForecastCostUsd");

    // September in full: 30 days of 11.5, with 5 of tax on the 1st.
    expect(forecast.datum.Value).toBe(350);
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
  const labels = [...Object.values(services.services), services.otherServices, services.taxAndFees];

  it("puts every service in a category the dashboards colour", () => {
    expect(labels.filter(({ category }) => !categories.includes(category))).toEqual([]);
    expect(services.categories.filter(({ colour }) => !/^#[0-9a-f]{6}$/.test(colour))).toEqual([]);
  });

  it("gives every service its own label, since the label is the series' dimension", () => {
    const names = labels.map(({ label }) => label);

    expect(new Set(names).size).toBe(names.length);
  });
});
