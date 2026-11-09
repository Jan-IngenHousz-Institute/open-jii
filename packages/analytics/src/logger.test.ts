import { describe, expect, it } from "vitest";

import { pinoConfig } from "./logger";

const TOKEN = "eyJ2IjoxfQ.c2lnbmF0dXJl";

const serialize = (url: string): unknown => {
  const req = pinoConfig.serializers?.req;
  if (!req) throw new Error("pinoConfig has no req serializer");
  return req({ id: "req-1", method: "POST", url });
};

describe("the request serializer", () => {
  it("logs the unsubscribe route without its token", () => {
    const serialized = serialize(`/api/v1/notifications/email/unsubscribe/${TOKEN}`);

    expect(serialized).toEqual({
      id: "req-1",
      method: "POST",
      url: "/api/v1/notifications/email/unsubscribe/[redacted]",
    });
    expect(JSON.stringify(serialized)).not.toContain(TOKEN);
  });
});
