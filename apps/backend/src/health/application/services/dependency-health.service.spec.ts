import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthIndicatorService, TerminusModule } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort, HealthMetric } from "../../core/ports/aws.port";
import { DatabaseHealthIndicator } from "../indicators/database.indicator";
import { DatabricksHealthIndicator } from "../indicators/databricks.indicator";
import { EmailHealthIndicator } from "../indicators/email.indicator";
import { IotHealthIndicator } from "../indicators/iot.indicator";
import {
  DEPENDENCY_CHECK_TIMEOUT_MS,
  DEPENDENCY_HEALTH_NAMESPACE,
  DependencyHealthService,
} from "./dependency-health.service";

const results = new HealthIndicatorService();
const up = <const Key extends string>(key: Key): Promise<HealthIndicatorResult<Key>> =>
  Promise.resolve(results.check(key).up());

describe("DependencyHealthService", () => {
  const awsPort = {
    databaseClusterStatus: vi.fn<AwsPort["databaseClusterStatus"]>(),
    latestDatabaseCapacity: vi.fn<AwsPort["latestDatabaseCapacity"]>(),
    probeIotEndpoint: vi.fn<AwsPort["probeIotEndpoint"]>(),
    publishMetrics: vi.fn<AwsPort["publishMetrics"]>(),
  };
  const database = { check: vi.fn() };
  const databricks = { check: vi.fn() };
  const email = { check: vi.fn() };
  const iot = { check: vi.fn() };
  let config: Record<string, unknown>;
  let service: DependencyHealthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    config = { "health.deployed": true, "health.environment": "dev" };
    database.check.mockImplementation(() =>
      Promise.resolve(results.check("database").up({ paused: true })),
    );
    databricks.check.mockImplementation(() => up("databricks"));
    email.check.mockImplementation(() => up("email"));
    iot.check.mockImplementation(() => up("iot"));
    awsPort.publishMetrics.mockResolvedValue(success(undefined));

    const module = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false })],
      providers: [
        DependencyHealthService,
        { provide: DatabaseHealthIndicator, useValue: database },
        { provide: DatabricksHealthIndicator, useValue: databricks },
        { provide: EmailHealthIndicator, useValue: email },
        { provide: IotHealthIndicator, useValue: iot },
        { provide: HEALTH_AWS_PORT, useValue: awsPort },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();
    service = module.get(DependencyHealthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function published(): HealthMetric[] {
    const call = awsPort.publishMetrics.mock.calls.at(0);
    expect(call?.[0]).toBe(DEPENDENCY_HEALTH_NAMESPACE);
    return call?.[1] ?? [];
  }

  function value(metrics: HealthMetric[], name: string, dependency: string): number | undefined {
    return metrics.find(
      (metric) => metric.name === name && metric.dimensions.Dependency === dependency,
    )?.value;
  }

  it("does nothing outside the deployed service", async () => {
    config["health.deployed"] = false;

    await service.checkDependencies();

    expect(database.check).not.toHaveBeenCalled();
    expect(awsPort.publishMetrics).not.toHaveBeenCalled();
  });

  it("publishes every dependency as up, and the database as paused", async () => {
    await service.checkDependencies();

    const metrics = published();
    for (const dependency of ["database", "databricks", "email", "iot"]) {
      expect(value(metrics, "DependencyUp", dependency)).toBe(1);
      expect(value(metrics, "DependencyCheckMilliseconds", dependency)).toBeGreaterThanOrEqual(0);
    }
    expect(value(metrics, "DependencyPaused", "database")).toBe(1);
    expect(value(metrics, "DependencyPaused", "email")).toBeUndefined();
    expect(metrics.every((metric) => metric.dimensions.Environment === "dev")).toBe(true);
  });

  it("still publishes when a dependency is down, with that one at zero", async () => {
    email.check.mockImplementation(() =>
      Promise.resolve(results.check("email").down({ reason: "535 Authentication failed" })),
    );

    await service.checkDependencies();

    const metrics = published();
    expect(value(metrics, "DependencyUp", "email")).toBe(0);
    expect(value(metrics, "DependencyUp", "iot")).toBe(1);
  });

  it("marks a dependency that does not answer in time as down", async () => {
    vi.useFakeTimers();
    iot.check.mockImplementation(() => new Promise(() => undefined));

    const run = service.checkDependencies();
    await vi.advanceTimersByTimeAsync(DEPENDENCY_CHECK_TIMEOUT_MS);
    await run;

    expect(value(published(), "DependencyUp", "iot")).toBe(0);
  });

  it("logs a failed publish with its error code", async () => {
    awsPort.publishMetrics.mockResolvedValue(failure(AppError.internal("AccessDenied")));
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    await service.checkDependencies();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: ErrorCodes.DEPENDENCY_HEALTH_PUBLISH_FAILED }),
    );
  });
});
