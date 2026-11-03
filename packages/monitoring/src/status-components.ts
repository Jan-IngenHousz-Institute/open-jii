import type { StatusComponentId } from "./status-document.js";

export type StatusRegion = "eu-central-1" | "us-east-1";

/** The identifiers that differ per environment; everything else a query names is fixed. */
export interface StatusConfig {
  environment: string;
  albArnSuffix: string;
  webDistributionId: string;
  kinesisStreamName: string;
}

/** The parts of the AWS SDK's `MetricDataQuery` the status queries use, so the package needs no SDK. */
export interface MetricDataQuery {
  Id: string;
  MetricStat?: {
    Metric: {
      Namespace: string;
      MetricName: string;
      Dimensions: { Name: string; Value: string }[];
    };
    Period: number;
    Stat: string;
  };
  Expression?: string;
  ReturnData?: boolean;
}

export const STATUS_SIGNAL_IDS = [
  "websiteRequests",
  "websiteFailedRequests",
  "databaseUp",
  "databricksUp",
  "albElb5xx",
  "albTarget5xx",
  "albRequests",
  "emailUp",
  "ingestForwardingFailures",
  "ingestRefusedPublishes",
  "ingestThrottled",
  "iotUp",
  "ingestPublished",
  "experimentLatencyP95",
  "collectorHeartbeat",
  "ingestIteratorAge",
  "macroPlatformFailures",
  "macroLatencyP95",
  "macroBacklog",
  "exportsFailed",
] as const;

/** Also the `Id` of the signal's query, which CloudWatch requires to start with a lowercase letter. */
type StatusSignalId = (typeof STATUS_SIGNAL_IDS)[number];

/** Absent means CloudWatch had no datapoint in the signal's lookback. */
export type StatusReadings = Partial<Record<StatusSignalId, number>>;

/**
 * How a signal's datapoints inside its lookback become one reading. A count is summed, a
 * level the rules compare with a limit is the highest, and a gauge published every few minutes
 * is its newest point, so a recovered value stops counting as soon as the next one lands.
 */
type SignalReduction = "sum" | "max" | "latest";

/** CloudFront publishes its metrics in us-east-1 whatever region serves the site. */
const CLOUDFRONT_REGION: StatusRegion = "us-east-1";

const HOME_REGION: StatusRegion = "eu-central-1";

/** One-minute points, the finest CloudWatch keeps for the AWS service metrics read here. */
const AWS_PERIOD_SECONDS = 60;

/** The backend checks every five minutes and the heartbeat export every half hour, so finer buckets would be mostly empty. */
const OPENJII_PERIOD_SECONDS = 300;

/** Every count rule reads this long a window, so one bad minute neither flaps the page nor lingers. */
export const RULE_WINDOW_MINUTES = 15;

/** The macro failures rule counts the last hour, since the heartbeat export reports them per half hour. */
export const MACRO_FAILURE_WINDOW_MINUTES = 60;

/** The backend checks its dependencies every five minutes, so ten spans one missed check. */
export const DEPENDENCY_WINDOW_MINUTES = 10;

/** Iterator age moves slowly, so a few minutes is enough to read its level. */
export const LAG_WINDOW_MINUTES = 5;

/** The messages per minute figure averages over this many minutes. */
export const INGEST_THROUGHPUT_WINDOW_MINUTES = 5;

/**
 * The heartbeat export publishes every half hour, so 75 minutes spans two missed runs plus delivery
 * lag; a collector silent for that long is stopped, not late.
 */
export const PIPELINE_WINDOW_MINUTES = 75;

export interface StatusSignal {
  id: StatusSignalId;
  region: StatusRegion;
  periodSeconds: number;
  lookbackMinutes: number;
  reduce: SignalReduction;
  /** The query whose result is the reading. */
  query: MetricDataQuery;
  /** Queries the expression reads, fetched with ReturnData off. */
  inputs: MetricDataQuery[];
}

interface StatusComponentDefinition {
  id: StatusComponentId;
  /** Components not yet live are omitted from the document and cost no CloudWatch reads. */
  live: boolean;
  signals: StatusSignalId[];
}

export const STATUS_COMPONENTS: StatusComponentDefinition[] = [
  { id: "website", live: true, signals: ["websiteRequests", "websiteFailedRequests"] },
  { id: "sign-in", live: false, signals: ["emailUp"] },
  {
    id: "platform",
    live: true,
    signals: ["databaseUp", "databricksUp", "albElb5xx", "albTarget5xx", "albRequests"],
  },
  {
    id: "data-intake",
    live: true,
    signals: [
      "ingestForwardingFailures",
      "ingestRefusedPublishes",
      "ingestThrottled",
      "iotUp",
      "ingestPublished",
    ],
  },
  {
    id: "data-delivery",
    live: true,
    signals: ["experimentLatencyP95", "collectorHeartbeat", "ingestIteratorAge", "databricksUp"],
  },
  {
    id: "macro-processing",
    live: true,
    signals: ["macroPlatformFailures", "macroLatencyP95", "macroBacklog"],
  },
  { id: "exports", live: false, signals: ["exportsFailed"] },
];

type QueryBuilder = (id: string, periodSeconds: number) => MetricDataQuery;

function metricRead(
  namespace: string,
  metric: string,
  stat: string,
  dimensions: [string, string][],
): QueryBuilder {
  return (id, periodSeconds) => ({
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: namespace,
        MetricName: metric,
        Dimensions: dimensions.map(([Name, Value]) => ({ Name, Value })),
      },
      Period: periodSeconds,
      Stat: stat,
    },
  });
}

/** A SEARCH returns one series per match, so SUM folds them into the single series a reading needs. */
function searchSum(schema: string, filter: string): QueryBuilder {
  return (id, periodSeconds) => ({
    Id: id,
    Expression: `SUM(SEARCH('${schema} ${filter}', 'Sum', ${periodSeconds}))`,
  });
}

interface SignalTiming {
  region: StatusRegion;
  periodSeconds: number;
  lookbackMinutes: number;
  reduce: SignalReduction;
}

interface SignalDefinition extends SignalTiming {
  id: StatusSignalId;
  read: QueryBuilder;
  inputs?: MetricDataQuery[];
}

function define(definition: SignalDefinition): StatusSignal {
  const { id, region, periodSeconds, lookbackMinutes, reduce, read, inputs } = definition;
  return {
    id,
    region,
    periodSeconds,
    lookbackMinutes,
    reduce,
    query: read(id, periodSeconds),
    inputs: inputs ?? [],
  };
}

/** Every signal, live or not, with the queries it takes to read it in this environment. */
export function statusSignals(config: StatusConfig): StatusSignal[] {
  const environment: [string, string] = ["Environment", config.environment];
  const dependencyUp = (dependency: string) =>
    metricRead("OpenJII/Backend", "DependencyUp", "Minimum", [
      environment,
      ["Dependency", dependency],
    ]);
  const loadBalancer = (metric: string) =>
    metricRead("AWS/ApplicationELB", metric, "Sum", [["LoadBalancer", config.albArnSuffix]]);
  const distribution = (metric: string, stat: string) =>
    metricRead("AWS/CloudFront", metric, stat, [
      ["DistributionId", config.webDistributionId],
      ["Region", "Global"],
    ]);
  const stream = (metric: string, stat: string) =>
    metricRead("AWS/Kinesis", metric, stat, [["StreamName", config.kinesisStreamName]]);
  const heartbeat = (metric: string, stat: string, extra: [string, string][] = []) =>
    metricRead("OpenJII/Data", metric, stat, [environment, ...extra]);

  const dependencyCheck: SignalTiming = {
    region: HOME_REGION,
    periodSeconds: OPENJII_PERIOD_SECONDS,
    lookbackMinutes: DEPENDENCY_WINDOW_MINUTES,
    reduce: "latest",
  };
  const awsCount: SignalTiming = {
    region: HOME_REGION,
    periodSeconds: AWS_PERIOD_SECONDS,
    lookbackMinutes: RULE_WINDOW_MINUTES,
    reduce: "sum",
  };
  const pipelineGauge: SignalTiming = {
    region: HOME_REGION,
    periodSeconds: OPENJII_PERIOD_SECONDS,
    lookbackMinutes: PIPELINE_WINDOW_MINUTES,
    reduce: "latest",
  };
  const cloudFrontCount = { ...awsCount, region: CLOUDFRONT_REGION };

  return [
    define({ ...cloudFrontCount, id: "websiteRequests", read: distribution("Requests", "Sum") }),
    define({
      ...cloudFrontCount,
      id: "websiteFailedRequests",
      // The error rate is a per-minute average, so averaging it again would let two failed requests
      // in a quiet minute outweigh a busy healthy one. Weighting by requests gives the window's rate.
      read: (id) => ({ Id: id, Expression: "websiteErrorRate * websiteRequests / 100" }),
      inputs: [
        {
          ...distribution("5xxErrorRate", "Average")("websiteErrorRate", AWS_PERIOD_SECONDS),
          ReturnData: false,
        },
      ],
    }),

    define({ ...dependencyCheck, id: "databaseUp", read: dependencyUp("database") }),
    define({ ...dependencyCheck, id: "databricksUp", read: dependencyUp("databricks") }),
    define({ ...awsCount, id: "albElb5xx", read: loadBalancer("HTTPCode_ELB_5XX_Count") }),
    define({ ...awsCount, id: "albTarget5xx", read: loadBalancer("HTTPCode_Target_5XX_Count") }),
    define({ ...awsCount, id: "albRequests", read: loadBalancer("RequestCount") }),

    define({ ...dependencyCheck, id: "emailUp", read: dependencyUp("email") }),

    define({
      ...awsCount,
      id: "ingestForwardingFailures",
      read: searchSum("{AWS/IoT,ActionType,RuleName}", 'MetricName="Failure"'),
    }),
    define({
      ...awsCount,
      id: "ingestRefusedPublishes",
      read: searchSum(
        "{AWS/IoT,Protocol}",
        'MetricName="PublishIn.ServerError" OR MetricName="PublishIn.Throttle"',
      ),
    }),
    define({
      ...awsCount,
      id: "ingestThrottled",
      read: stream("WriteProvisionedThroughputExceeded", "Sum"),
    }),
    define({ ...dependencyCheck, id: "iotUp", read: dependencyUp("iot") }),
    define({
      ...awsCount,
      id: "ingestPublished",
      lookbackMinutes: INGEST_THROUGHPUT_WINDOW_MINUTES,
      // Devices publish over MQTT; the ingest health check publishes over HTTP and is not traffic.
      read: searchSum("{AWS/IoT,Protocol}", 'MetricName="PublishIn.Success" AND Protocol="MQTT"'),
    }),

    define({
      ...pipelineGauge,
      id: "experimentLatencyP95",
      read: heartbeat("ExperimentLatencyP95Seconds", "Maximum"),
    }),
    define({
      ...pipelineGauge,
      id: "collectorHeartbeat",
      reduce: "max",
      read: heartbeat("CollectorHeartbeat", "Maximum"),
    }),
    define({
      ...awsCount,
      id: "ingestIteratorAge",
      lookbackMinutes: LAG_WINDOW_MINUTES,
      reduce: "max",
      read: stream("GetRecords.IteratorAgeMilliseconds", "Maximum"),
    }),

    define({
      ...awsCount,
      id: "macroPlatformFailures",
      periodSeconds: OPENJII_PERIOD_SECONDS,
      lookbackMinutes: MACRO_FAILURE_WINDOW_MINUTES,
      read: heartbeat("MacroFailedRows", "Sum", [["Cause", "platform"]]),
    }),
    define({
      ...pipelineGauge,
      id: "macroLatencyP95",
      read: heartbeat("MacroLatencyP95Seconds", "Maximum"),
    }),
    define({
      ...pipelineGauge,
      id: "macroBacklog",
      read: heartbeat("MacroBacklogRows", "Maximum"),
    }),

    define({
      ...awsCount,
      id: "exportsFailed",
      periodSeconds: OPENJII_PERIOD_SECONDS,
      lookbackMinutes: MACRO_FAILURE_WINDOW_MINUTES,
      read: metricRead("OpenJII/Backend", "ExportsFailed", "Sum", [
        environment,
        ["Cause", "platform"],
      ]),
    }),
  ];
}

export interface RegionQueries {
  region: StatusRegion;
  /** The `MetricDataQueries` of one GetMetricData call, helper queries included. */
  queries: MetricDataQuery[];
  /** The longest lookback of the signals in this region, which sets the call's start time. */
  lookbackMinutes: number;
  /** How to turn each returned query into a reading, over its own lookback. */
  readings: Pick<StatusSignal, "id" | "periodSeconds" | "lookbackMinutes" | "reduce">[];
}

/**
 * The reads a run needs, one GetMetricData call per region, for the live components only. A signal
 * two components share, such as the Databricks check, is read once.
 */
export function statusQueries(config: StatusConfig): RegionQueries[] {
  const wanted = new Set(
    STATUS_COMPONENTS.filter((component) => component.live).flatMap(
      (component) => component.signals,
    ),
  );
  const signals = statusSignals(config).filter((signal) => wanted.has(signal.id));
  const regions = [...new Set(signals.map((signal) => signal.region))];

  return regions.map((region) => {
    const inRegion = signals.filter((signal) => signal.region === region);
    return {
      region,
      queries: inRegion.flatMap((signal) => [...signal.inputs, signal.query]),
      lookbackMinutes: Math.max(...inRegion.map((signal) => signal.lookbackMinutes)),
      readings: inRegion.map(({ id, periodSeconds, lookbackMinutes, reduce }) => ({
        id,
        periodSeconds,
        lookbackMinutes,
        reduce,
      })),
    };
  });
}
