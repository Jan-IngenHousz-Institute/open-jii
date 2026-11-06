import { describe, expect, it } from "vitest";

import { pinoConfig, redactRequestUrl } from "./logger";

const TOKEN = "eyJ2IjoxfQ.c2lnbmF0dXJl";

const serialize = (url: string): unknown => {
  const req = pinoConfig.serializers?.req;
  if (!req) throw new Error("pinoConfig has no req serializer");
  return req({ id: "req-1", method: "POST", url });
};

describe("redactRequestUrl", () => {
  it.each(["unsubscribe", "resubscribe"])("redacts the token on the %s route", (route) => {
    expect(redactRequestUrl(`/api/v1/notifications/email/${route}/${TOKEN}`)).toBe(
      `/api/v1/notifications/email/${route}/[redacted]`,
    );
  });

  it.each(["/API/V1/NOTIFICATIONS/EMAIL/UNSUBSCRIBE/", "/api/v1/Notifications/Email/Resubscribe/"])(
    "redacts the token whatever the case of %s, keeping it as sent",
    (prefix) => {
      expect(redactRequestUrl(`${prefix}${TOKEN}`)).toBe(`${prefix}[redacted]`);
    },
  );

  it("keeps the query string", () => {
    expect(redactRequestUrl(`/api/v1/notifications/email/unsubscribe/${TOKEN}?source=mail`)).toBe(
      "/api/v1/notifications/email/unsubscribe/[redacted]?source=mail",
    );
  });

  it.each([
    "/api/v1/notifications/preferences",
    "/api/v1/notifications/email/unsubscribe",
    "/api/v1/notifications/email/unsubscribe/",
    "/en-US/unsubscribe?token=abc",
  ])("leaves %s untouched", (url) => {
    expect(redactRequestUrl(url)).toBe(url);
  });
});

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
