import type { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

import { zNotificationCategory } from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import {
  NOTIFICATION_CATEGORY_LABEL,
  NotificationUnsubscribeService,
} from "./notification-unsubscribe.service";

const EN_US_NOTIFICATIONS = resolve(
  __dirname,
  "../../../../../../packages/i18n/locales/en-US/notifications.json",
);

const zCategoryLabels = z.object({
  categories: z.record(z.string(), z.object({ label: z.string() })),
});

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Flips the character's lowest bit, which in a signature's last character is one of the unused bits.
const flipLowBit = (character: string) => BASE64URL[BASE64URL.indexOf(character) ^ 1];

const configWith = (values: Record<string, string>) =>
  ({
    getOrThrow: (key: string) => {
      if (!(key in values)) {
        throw new Error(`Missing config ${key}`);
      }
      return values[key];
    },
  }) as unknown as ConfigService;

const CONFIG = {
  "notification.unsubscribeSecret": "test-unsubscribe-secret",
  "auth.url": "https://api.example.org",
  "email.baseUrl": "https://openjii.example.org",
};

describe("NotificationUnsubscribeService", () => {
  const userId = "4b1f6f4e-2f0a-4c1e-9a43-6b7e8d1c2a10";
  const service = new NotificationUnsubscribeService(configWith(CONFIG));

  const expectInvalid = (token: string) => {
    const result = service.verify(token);
    assertFailure(result);
    expect(result.error.code).toBe(ErrorCodes.NOTIFICATION_UNSUBSCRIBE_LINK_INVALID);
    expect(result.error.statusCode).toBe(400);
  };

  it("verifies a signed token to its user, category and the email channel", () => {
    const result = service.verify(service.sign(userId, "requests_and_invitations"));

    assertSuccess(result);
    expect(result.value).toEqual({
      userId,
      category: "requests_and_invitations",
      channel: "email",
    });
  });

  it("refuses a token with one character of its signature changed", () => {
    const token = service.sign(userId, "requests_and_invitations");
    const [payload, signature] = token.split(".");
    for (const index of [0, signature.length - 1]) {
      expectInvalid(
        `${payload}.${signature.slice(0, index)}${flipLowBit(signature[index])}${signature.slice(index + 1)}`,
      );
    }
  });

  it("refuses a token whose signature is shorter than a real one", () => {
    expectInvalid(service.sign(userId, "requests_and_invitations").slice(0, -1));
  });

  it("refuses an edited payload that keeps the original signature", () => {
    const [encoded, signature] = service.sign(userId, "requests_and_invitations").split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const edited = Buffer.from(JSON.stringify({ ...payload, c: "project_transfers" })).toString(
      "base64url",
    );

    expectInvalid(`${edited}.${signature}`);
  });

  it("refuses a token signed with another secret", () => {
    const other = new NotificationUnsubscribeService(
      configWith({ ...CONFIG, "notification.unsubscribeSecret": "another-secret" }),
    );

    expectInvalid(other.sign(userId, "requests_and_invitations"));
  });

  it("refuses an expired token", () => {
    expectInvalid(service.sign(userId, "requests_and_invitations", new Date(Date.now() - 1000)));
  });

  it("refuses a token for a locked category", () => {
    expectInvalid(service.sign(userId, "account_security"));
  });

  it("refuses a string that is not a token", () => {
    expectInvalid("not-a-token");
    expectInvalid("");
    expectInvalid("a.b.c");
  });

  it("builds the settings and unsubscribe links on the web base and the one-click link on the API", () => {
    const footer = service.footerFor(userId, "requests_and_invitations");

    expect(footer.categoryLabel).toBe("Requests and invitations");
    expect(footer.settingsUrl).toBe("https://openjii.example.org/platform/account/notifications");

    const unsubscribe = new URL(footer.unsubscribeUrl);
    expect(`${unsubscribe.origin}${unsubscribe.pathname}`).toBe(
      "https://openjii.example.org/unsubscribe",
    );
    const token = unsubscribe.searchParams.get("token") ?? "";
    expect(footer.oneClickUrl).toBe(
      `https://api.example.org/api/v1/notifications/email/unsubscribe/${token}`,
    );

    const result = service.verify(token);
    assertSuccess(result);
    expect(result.value.userId).toBe(userId);
    expect(result.value.category).toBe("requests_and_invitations");
  });

  it("labels every category with its en-US settings label", () => {
    const { categories } = zCategoryLabels.parse(
      JSON.parse(readFileSync(EN_US_NOTIFICATIONS, "utf-8")),
    );

    for (const category of zNotificationCategory.options) {
      expect(NOTIFICATION_CATEGORY_LABEL[category]).toBe(categories[category].label);
    }
  });
});
