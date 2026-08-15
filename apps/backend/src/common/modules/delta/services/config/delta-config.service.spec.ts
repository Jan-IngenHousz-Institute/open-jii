import { ConfigService } from "@nestjs/config";

import { DeltaConfigService } from "./delta-config.service";

const makeService = (config: Record<string, unknown>): DeltaConfigService =>
  new DeltaConfigService(new ConfigService(config));

describe("DeltaConfigService", () => {
  it("does not throw at construction with empty config", () => {
    expect(() => makeService({})).not.toThrow();
  });

  it("defaults the schema and request timeout", () => {
    const service = makeService({});

    expect(service.getSchemaName()).toBe("centrum");
    expect(service.getRequestTimeout()).toBe(DeltaConfigService.DEFAULT_REQUEST_TIMEOUT);
  });

  it("falls back to the default timeout on an unparseable value", () => {
    expect(makeService({ delta: { requestTimeout: "soon" } }).getRequestTimeout()).toBe(
      DeltaConfigService.DEFAULT_REQUEST_TIMEOUT,
    );
    expect(makeService({ delta: { requestTimeout: "5000" } }).getRequestTimeout()).toBe(5000);
  });

  it("assertReady reports every missing key at once", () => {
    const service = makeService({ delta: { endpoint: "https://share.example" } });

    expect(() => service.assertReady()).toThrow(/DELTA_BEARER_TOKEN.*DELTA_SHARE_NAME/);
  });

  it("assertReady passes with a complete configuration", () => {
    const service = makeService({
      delta: { endpoint: "https://share.example", bearerToken: "t", shareName: "s" },
    });

    expect(() => service.assertReady()).not.toThrow();
  });
});
