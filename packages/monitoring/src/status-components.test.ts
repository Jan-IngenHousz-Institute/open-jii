import { describe, expect, it } from "vitest";

import {
  INGEST_THROUGHPUT_WINDOW_MINUTES,
  STALL_PUBLISHES_END_MINUTES,
  STALL_PUBLISHES_START_MINUTES,
  STATUS_COMPONENTS,
  STATUS_SIGNAL_IDS,
  statusQueries,
  statusSignals,
} from "./status-components.js";
import type { MetricDataQuery, StatusConfig } from "./status-components.js";
import { STATUS_COMPONENT_IDS } from "./status-document.js";

const config: StatusConfig = {
  environment: "prod",
  albArnSuffix: "app/backend-alb/abc123",
  webDistributionId: "E2EXAMPLE",
  kinesisStreamName: "ingest-stream-prod",
};

const QUERY_ID = /^[a-z][a-zA-Z0-9_]*$/;

function queryFor(id: string): MetricDataQuery {
  for (const region of statusQueries(config)) {
    const found = region.queries.find((query) => query.Id === id);
    if (found !== undefined) {
      return found;
    }
  }
  throw new Error(`no query ${id}`);
}

describe("STATUS_COMPONENTS", () => {
  it("lists every component once, in the contract's order", () => {
    expect(STATUS_COMPONENTS.map((component) => component.id)).toEqual([...STATUS_COMPONENT_IDS]);
  });

  it("marks sign-in and exports as not live and the rest as live", () => {
    const notLive = STATUS_COMPONENTS.filter((component) => !component.live).map(
      (component) => component.id,
    );

    expect(notLive).toEqual(["sign-in", "exports"]);
  });

  it("gives every signal to at least one component and none that does not exist", () => {
    const used = new Set(STATUS_COMPONENTS.flatMap((component) => component.signals));

    expect([...used].sort()).toEqual([...STATUS_SIGNAL_IDS].sort());
  });
});

describe("statusSignals", () => {
  const signals = statusSignals(config);

  it("defines each signal exactly once", () => {
    expect(signals.map((signal) => signal.id).sort()).toEqual([...STATUS_SIGNAL_IDS].sort());
  });

  it("names every query with an Id CloudWatch accepts, and uniquely", () => {
    const ids = signals.flatMap((signal) =>
      [...signal.inputs, signal.query].map((query) => query.Id),
    );

    expect(ids.filter((id) => !QUERY_ID.test(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ties each signal to the query that returns it", () => {
    for (const signal of signals) {
      expect(signal.query.Id).toBe(signal.id);
      expect(signal.query.ReturnData).not.toBe(false);
      expect(signal.inputs.every((input) => input.ReturnData === false)).toBe(true);
    }
  });

  it("reads each plain metric at its signal's period and each SEARCH with the same one", () => {
    for (const signal of signals) {
      const { MetricStat, Expression } = signal.query;

      expect(signal.periodSeconds % 60).toBe(0);
      if (MetricStat !== undefined) {
        expect(MetricStat.Period).toBe(signal.periodSeconds);
      }
      if (Expression?.includes("SEARCH(") === true) {
        expect(Expression).toMatch(new RegExp(`, ${signal.periodSeconds}\\)\\)$`));
      }
    }
  });

  it("looks back at least one period", () => {
    for (const signal of signals) {
      expect(signal.lookbackMinutes * 60).toBeGreaterThanOrEqual(signal.periodSeconds);
    }
  });

  it("puts the expression's inputs in the region the expression runs in", () => {
    const failed = signals.find((signal) => signal.id === "websiteFailedRequests");
    const requests = signals.find((signal) => signal.id === "websiteRequests");

    expect(failed?.region).toBe("us-east-1");
    expect(requests?.region).toBe("us-east-1");
  });
});

describe("statusQueries", () => {
  const regions = statusQueries(config);

  function region(name: string) {
    const found = regions.find((entry) => entry.region === name);
    if (found === undefined) {
      throw new Error(`no ${name} queries`);
    }
    return found;
  }

  it("groups the live reads by the region they must be made in", () => {
    expect(regions.map((entry) => entry.region).sort()).toEqual(["eu-central-1", "us-east-1"]);
    expect(
      region("us-east-1")
        .queries.filter((query) => query.MetricStat !== undefined)
        .every((query) => query.MetricStat?.Metric.Namespace === "AWS/CloudFront"),
    ).toBe(true);
    expect(
      region("eu-central-1").queries.some(
        (query) => query.MetricStat?.Metric.Namespace === "AWS/CloudFront",
      ),
    ).toBe(false);
  });

  it("reads messages per minute over five whole minutes that CloudWatch has finished counting", () => {
    const published = region("eu-central-1").readings.find(({ id }) => id === "ingestPublished");

    expect(published).toMatchObject({
      lookbackMinutes: INGEST_THROUGHPUT_WINDOW_MINUTES + 1,
      endMinutesAgo: 1,
    });
  });

  it("reads device publishes from an hour to 45 minutes ago beside bronze's idle reading", () => {
    const publishes = region("eu-central-1").readings.find(
      ({ id }) => id === "devicePublishesBeforeIdle",
    );

    expect(publishes).toMatchObject({
      lookbackMinutes: STALL_PUBLISHES_START_MINUTES,
      endMinutesAgo: STALL_PUBLISHES_END_MINUTES,
    });
  });

  it("leaves out the signals of components that are not live", () => {
    const ids = regions.flatMap((entry) => entry.readings.map((reading) => reading.id));

    expect(ids).not.toContain("emailUp");
    expect(ids).not.toContain("exportsFailed");
    expect(JSON.stringify(regions)).not.toContain("ExportsFailed");
  });

  it("reads every signal of every live component, and a shared one once", () => {
    const ids = regions.flatMap((entry) => entry.readings.map((reading) => reading.id));
    const wanted = new Set(
      STATUS_COMPONENTS.filter((component) => component.live).flatMap(
        (component) => component.signals,
      ),
    );

    expect(ids.sort()).toEqual([...wanted].sort());
    expect(ids.filter((id) => id === "databricksUp")).toHaveLength(1);
  });

  it("sets each call's lookback to its longest signal's", () => {
    for (const entry of regions) {
      expect(entry.lookbackMinutes).toBe(
        Math.max(...entry.readings.map((reading) => reading.lookbackMinutes)),
      );
    }
    expect(region("us-east-1").lookbackMinutes).toBe(15);
    expect(region("eu-central-1").lookbackMinutes).toBe(75);
  });

  it("returns an Id for each reading and for each helper query", () => {
    for (const entry of regions) {
      const ids = entry.queries.map((query) => query.Id);

      expect(entry.readings.every((reading) => ids.includes(reading.id))).toBe(true);
      expect(ids).toHaveLength(entry.readings.length + (entry.region === "us-east-1" ? 1 : 0));
    }
  });

  it("resolves every name a math expression uses within its own call", () => {
    let mathQueries = 0;

    for (const entry of regions) {
      const ids = new Set(entry.queries.map((query) => query.Id));
      const math = entry.queries.filter(
        (query) => query.Expression !== undefined && !query.Expression.includes("SEARCH("),
      );

      for (const query of math) {
        const names = query.Expression?.match(/[a-z][a-zA-Z0-9_]*/g) ?? [];
        expect(names.filter((name) => !ids.has(name))).toEqual([]);
      }
      mathQueries += math.length;
    }

    expect(mathQueries).toBe(1);
  });

  it("weighs the CloudFront error rate by requests", () => {
    expect(queryFor("websiteFailedRequests")).toEqual({
      Id: "websiteFailedRequests",
      Expression: "websiteErrorRate * websiteRequests / 100",
    });
    expect(queryFor("websiteErrorRate")).toEqual({
      Id: "websiteErrorRate",
      MetricStat: {
        Metric: {
          Namespace: "AWS/CloudFront",
          MetricName: "5xxErrorRate",
          Dimensions: [
            { Name: "DistributionId", Value: "E2EXAMPLE" },
            { Name: "Region", Value: "Global" },
          ],
        },
        Period: 60,
        Stat: "Average",
      },
      ReturnData: false,
    });
  });

  it.each([
    [
      "databaseUp",
      {
        Id: "databaseUp",
        MetricStat: {
          Metric: {
            Namespace: "OpenJII/Backend",
            MetricName: "DependencyUp",
            Dimensions: [
              { Name: "Environment", Value: "prod" },
              { Name: "Dependency", Value: "database" },
            ],
          },
          Period: 300,
          Stat: "Minimum",
        },
      },
    ],
    [
      "albTarget5xx",
      {
        Id: "albTarget5xx",
        MetricStat: {
          Metric: {
            Namespace: "AWS/ApplicationELB",
            MetricName: "HTTPCode_Target_5XX_Count",
            Dimensions: [{ Name: "LoadBalancer", Value: "app/backend-alb/abc123" }],
          },
          Period: 60,
          Stat: "Sum",
        },
      },
    ],
    [
      "ingestForwardingFailures",
      {
        Id: "ingestForwardingFailures",
        Expression:
          "SUM(SEARCH('{AWS/IoT,ActionType,RuleName} MetricName=\"Failure\"', 'Sum', 60))",
      },
    ],
    [
      "ingestPublished",
      {
        Id: "ingestPublished",
        Expression:
          "SUM(SEARCH('{AWS/IoT,Protocol} MetricName=\"PublishIn.Success\" AND Protocol=\"MQTT\"', 'Sum', 60))",
      },
    ],
    [
      "devicePublishesBeforeIdle",
      {
        Id: "devicePublishesBeforeIdle",
        Expression:
          "SUM(SEARCH('{AWS/IoT,Protocol} MetricName=\"PublishIn.Success\" AND Protocol=\"MQTT\"', 'Sum', 60))",
      },
    ],
    [
      "ingestRefusedPublishes",
      {
        Id: "ingestRefusedPublishes",
        Expression:
          "SUM(SEARCH('{AWS/IoT,Protocol} MetricName=\"PublishIn.ServerError\" OR MetricName=\"PublishIn.Throttle\"', 'Sum', 60))",
      },
    ],
    [
      "macroPlatformFailures",
      {
        Id: "macroPlatformFailures",
        MetricStat: {
          Metric: {
            Namespace: "OpenJII/Data",
            MetricName: "MacroFailedRows",
            Dimensions: [
              { Name: "Environment", Value: "prod" },
              { Name: "Cause", Value: "platform" },
            ],
          },
          Period: 300,
          Stat: "Sum",
        },
      },
    ],
    [
      "ingestIteratorAge",
      {
        Id: "ingestIteratorAge",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Kinesis",
            MetricName: "GetRecords.IteratorAgeMilliseconds",
            Dimensions: [{ Name: "StreamName", Value: "ingest-stream-prod" }],
          },
          Period: 60,
          Stat: "Maximum",
        },
      },
    ],
  ] satisfies [string, MetricDataQuery][])(
    "builds %s as the catalogue names it",
    (id, expected) => {
      expect(queryFor(id)).toEqual(expected);
    },
  );

  it("counts only server errors and throttling as refused publishes", () => {
    const expression = queryFor("ingestRefusedPublishes").Expression ?? "";

    expect(expression).not.toContain("ClientError");
    expect(expression).not.toContain("AuthError");
  });
});
