import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ORPCModule } from "@orpc/nest";
import request from "supertest";

import { HealthOrpcController } from "./health.orpc.controller";

describe("HealthOrpcController (oRPC PoC)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ORPCModule.forRoot({})],
      controllers: [HealthOrpcController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health/time returns the contract-typed payload", async () => {
    const res = await request(app.getHttpServer()).get("/health/time");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("utcTimestampMs");
    expect(res.body).toHaveProperty("utcTimestampSec");
    expect(res.body).toHaveProperty("iso");
    expect(res.body.utcTimestampSec).toBe(Math.floor(res.body.utcTimestampMs / 1000));
    expect(new Date(res.body.iso).getTime()).toBe(res.body.utcTimestampMs);
  });
});
