import { ConfigService } from "@nestjs/config";

import { assertFailure } from "../../../../utils/fp-utils";
import { ServingStoreClientService } from "../client/client.service";
import { ServingStoreConfigService } from "./config.service";

describe("ServingStoreConfigService", () => {
  const configOf = (servingStore: Record<string, string | undefined>) =>
    new ServingStoreConfigService(new ConfigService({ servingStore }));

  it("has no store where the url is unset or blank", () => {
    expect(configOf({}).getConfig()).toBeNull();
    expect(configOf({ url: "" }).getConfig()).toBeNull();
  });

  it("reads the store's url and the reader's credentials", () => {
    const config = configOf({ url: "http://10.0.1.5:8123", username: "reader", password: "p" });

    expect(config.getConfig()).toEqual({
      url: "http://10.0.1.5:8123",
      username: "reader",
      password: "p",
    });
  });

  it("stops boot for a store without credentials, naming the fields and never a value", () => {
    expect(() => configOf({ url: "http://10.0.1.5:8123", username: "reader" })).toThrow(
      "Invalid serving store configuration: password",
    );
  });

  it("refuses a read where there is no store", async () => {
    const client = new ServingStoreClientService(configOf({}));

    const result = await client.query("SELECT 1");

    assertFailure(result);
    expect(result.error.code).toBe("STORE_NOT_CONFIGURED");
  });
});
