import { Test } from "@nestjs/testing";
import request from "supertest";

import corsConfig from "./cors.config";

describe("corsConfig", () => {
  it("lets the web read which source answered a tables listing", async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    app.enableCors(corsConfig().options);
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/")
      .set("Origin", "http://localhost:3000");
    await app.close();

    expect(response.headers["access-control-expose-headers"]).toContain("X-Data-Source");
  });
});
