import { HealthIndicatorService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import { IotHealthIndicator } from "./iot.indicator";

describe("IotHealthIndicator", () => {
  const awsPort = {
    databaseClusterStatus: vi.fn(),
    latestDatabaseCapacity: vi.fn(),
    probeIotEndpoint: vi.fn(),
    publishMetrics: vi.fn(),
  };
  let indicator: IotHealthIndicator;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        IotHealthIndicator,
        HealthIndicatorService,
        { provide: HEALTH_AWS_PORT, useValue: awsPort },
      ],
    }).compile();
    indicator = module.get(IotHealthIndicator);
  });

  it("reports up when the IoT endpoint answers", async () => {
    awsPort.probeIotEndpoint.mockResolvedValue(success(undefined));

    expect(await indicator.check()).toEqual({ iot: { status: "up" } });
  });

  it("reports down with the reason when it does not", async () => {
    awsPort.probeIotEndpoint.mockResolvedValue(failure(AppError.internal("ThrottlingException")));

    expect(await indicator.check()).toEqual({
      iot: { status: "down", reason: "ThrottlingException" },
    });
  });
});
