import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ORPCModule } from "@orpc/nest";
import request from "supertest";

import { zHealthTimeResponse } from "@repo/api/domains/health/health.orpc";

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
    const body = zHealthTimeResponse.parse(res.body);
    expect(body.utcTimestampSec).toBe(Math.floor(body.utcTimestampMs / 1000));
    expect(new Date(body.iso).getTime()).toBe(body.utcTimestampMs);
  });
});
