import { describe, expect, it } from "vitest";

import { redactRequestUrl } from "./redact-url";

const TOKEN = "eyJ2IjoxfQ.c2lnbmF0dXJl";

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
    [
      `https://openjii.org/en-US/unsubscribe?token=${TOKEN}`,
      "https://openjii.org/en-US/unsubscribe?token=[redacted]",
    ],
    [
      `/en-US/unsubscribe?utm=mail&token=${TOKEN}#top`,
      "/en-US/unsubscribe?utm=mail&token=[redacted]#top",
    ],
  ])("redacts the page's token parameter in %s", (url, redacted) => {
    expect(redactRequestUrl(url)).toBe(redacted);
  });

  it.each([
    "/api/v1/notifications/preferences",
    "/api/v1/notifications/email/unsubscribe",
    "/api/v1/notifications/email/unsubscribe/",
    "/en-US/platform?tokens=1&mytoken=2",
  ])("leaves %s untouched", (url) => {
    expect(redactRequestUrl(url)).toBe(url);
  });
});
