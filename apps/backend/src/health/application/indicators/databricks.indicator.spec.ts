import { HealthIndicatorService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { HEALTH_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import { DatabricksHealthIndicator } from "./databricks.indicator";

describe("DatabricksHealthIndicator", () => {
  const databricksPort = { healthCheck: vi.fn() };
  let indicator: DatabricksHealthIndicator;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DatabricksHealthIndicator,
        HealthIndicatorService,
        { provide: HEALTH_DATABRICKS_PORT, useValue: databricksPort },
      ],
    }).compile();
    indicator = module.get(DatabricksHealthIndicator);
  });

  it("reports up when the workspace answers", async () => {
    databricksPort.healthCheck.mockResolvedValue(success({ healthy: true, service: "databricks" }));

    expect(await indicator.check()).toEqual({ databricks: { status: "up" } });
  });

  it("reports down when the workspace calls itself unhealthy", async () => {
    databricksPort.healthCheck.mockResolvedValue(
      success({ healthy: false, service: "databricks" }),
    );

    expect((await indicator.check()).databricks.status).toBe("down");
  });

  it("reports down with the reason when the request fails", async () => {
    databricksPort.healthCheck.mockResolvedValue(failure(AppError.internal("401 Unauthorized")));

    expect(await indicator.check()).toEqual({
      databricks: { status: "down", reason: "401 Unauthorized" },
    });
  });
});
