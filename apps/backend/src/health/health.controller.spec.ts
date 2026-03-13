import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should return status ok with a timestamp", () => {
    const result = controller.check();

    // Check structure and types of the response
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("timestamp");
    expect(result.status).toBe("ok");

    // Verify timestamp is a valid ISO date string
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(typeof result.timestamp).toBe("string");

    // Verify the timestamp is recent (within the last second)
    const resultDate = new Date(result.timestamp);
    const now = new Date();
    const timeDifference = Math.abs(now.getTime() - resultDate.getTime());
    expect(timeDifference).toBeLessThan(1000);
  });
});

describe("HealthController - getTime", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should return utcTimestampMs, utcTimestampSec, and iso fields", () => {
    const result = controller.getTime();

    expect(result).toHaveProperty("utcTimestampMs");
    expect(result).toHaveProperty("utcTimestampSec");
    expect(result).toHaveProperty("iso");
  });

  it("should return consistent timestamp values", () => {
    const before = Date.now();
    const result = controller.getTime();
    const after = Date.now();

    // utcTimestampMs should be between before and after
    expect(result.utcTimestampMs).toBeGreaterThanOrEqual(before);
    expect(result.utcTimestampMs).toBeLessThanOrEqual(after);

    // utcTimestampSec should be the floored seconds of utcTimestampMs
    expect(result.utcTimestampSec).toBe(Math.floor(result.utcTimestampMs / 1000));

    // iso should parse back to the same millisecond timestamp
    expect(new Date(result.iso).getTime()).toBe(result.utcTimestampMs);
  });

  it("should return a valid ISO 8601 string", () => {
    const result = controller.getTime();

    expect(typeof result.iso).toBe("string");
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
