import { HealthIndicatorService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import { DatabaseHealthIndicator } from "./database.indicator";

describe("DatabaseHealthIndicator", () => {
  const awsPort = {
    databaseClusterStatus: vi.fn(),
    latestDatabaseCapacity: vi.fn(),
    probeIotEndpoint: vi.fn(),
    publishMetrics: vi.fn(),
  };
  const clusterIdentifier = "open-jii-dev-db-cluster";
  let indicator: DatabaseHealthIndicator;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        HealthIndicatorService,
        { provide: HEALTH_AWS_PORT, useValue: awsPort },
      ],
    }).compile();
    indicator = module.get(DatabaseHealthIndicator);
  });

  it("reports a paused cluster as up and paused, from AWS alone", async () => {
    awsPort.databaseClusterStatus.mockResolvedValue(success("available"));
    awsPort.latestDatabaseCapacity.mockResolvedValue(success(0));

    const result = await indicator.check(clusterIdentifier);

    expect(result).toEqual({ database: { status: "up", paused: true } });
    expect(awsPort.latestDatabaseCapacity).toHaveBeenCalledWith("open-jii-dev-db-cluster");
  });

  it("reports a running cluster as up and not paused", async () => {
    awsPort.databaseClusterStatus.mockResolvedValue(success("backing-up"));
    awsPort.latestDatabaseCapacity.mockResolvedValue(success(0.5));

    expect(await indicator.check(clusterIdentifier)).toEqual({
      database: { status: "up", paused: false },
    });
  });

  it("reports a cluster that cannot serve as down, with its status", async () => {
    awsPort.databaseClusterStatus.mockResolvedValue(success("stopped"));

    expect(await indicator.check(clusterIdentifier)).toEqual({
      database: { status: "down", reason: "The cluster is stopped" },
    });
    expect(awsPort.latestDatabaseCapacity).not.toHaveBeenCalled();
  });

  it("reports down when AWS cannot be asked", async () => {
    awsPort.databaseClusterStatus.mockResolvedValue(failure(AppError.internal("AccessDenied")));

    expect(await indicator.check(clusterIdentifier)).toEqual({
      database: { status: "down", reason: "AccessDenied" },
    });
  });

  it("stays up, not paused, when the capacity cannot be read", async () => {
    awsPort.databaseClusterStatus.mockResolvedValue(success("available"));
    awsPort.latestDatabaseCapacity.mockResolvedValue(failure(AppError.internal("AccessDenied")));

    expect(await indicator.check(clusterIdentifier)).toEqual({
      database: { status: "up", paused: false },
    });
  });
});
