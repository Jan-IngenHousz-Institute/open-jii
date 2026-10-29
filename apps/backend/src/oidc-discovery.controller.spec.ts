import { Controller, Get, Logger } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@repo/auth/server";

import { OidcDiscoveryController } from "./oidc-discovery.controller";

const getOAuthServerConfig = vi.mocked(auth.api.getOAuthServerConfig);
const getSession = vi.mocked(auth.api.getSession);

@Controller("protected-discovery-control")
class ProtectedController {
  @Get()
  get() {
    return { protected: true };
  }
}

describe("OIDC authorization-server discovery alias over HTTP", () => {
  const discoveryPath = "/.well-known/oauth-authorization-server/api/v1/auth";
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OidcDiscoveryController, ProtectedController],
      providers: [
        {
          provide: APP_GUARD,
          inject: [Reflector],
          useFactory: (reflector: Reflector) => new AuthGuard(reflector, { auth }),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  beforeEach(() => {
    getOAuthServerConfig.mockReset();
    getSession.mockReset().mockResolvedValue(null);
  });

  afterAll(async () => {
    await app.close();
    getOAuthServerConfig.mockReset();
    getSession.mockReset().mockResolvedValue(null);
  });

  it("returns the provider metadata and cache policy without a session", async () => {
    const metadata: Awaited<ReturnType<typeof auth.api.getOAuthServerConfig>> = {
      issuer: "https://issuer.example/api/v1/auth",
      authorization_endpoint: "https://issuer.example/api/v1/auth/oauth2/authorize",
      token_endpoint: "https://issuer.example/api/v1/auth/oauth2/token",
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
    };
    getOAuthServerConfig.mockResolvedValue(metadata);

    const response = await request(app.getHttpServer())
      .get(discoveryPath)
      .expect(200)
      .expect("Content-Type", /json/)
      .expect("Cache-Control", "public, max-age=3600");

    expect(response.body).toEqual(metadata);
    expect(getOAuthServerConfig).toHaveBeenCalledExactlyOnceWith();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("still rejects unauthenticated requests to a route without the exemption", async () => {
    await request(app.getHttpServer()).get("/protected-discovery-control").expect(401);

    expect(getSession).toHaveBeenCalledOnce();
    expect(getOAuthServerConfig).not.toHaveBeenCalled();
  });

  it("returns a server error rather than successful metadata when the provider fails", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    getOAuthServerConfig.mockRejectedValue(new Error("Provider unavailable"));

    const response = await request(app.getHttpServer()).get(discoveryPath).expect(500);

    expect(response.body).toEqual({ statusCode: 500, message: "Internal server error" });
    expect(response.headers["cache-control"]).toBeUndefined();
    expect(getOAuthServerConfig).toHaveBeenCalledExactlyOnceWith();
  });
});
