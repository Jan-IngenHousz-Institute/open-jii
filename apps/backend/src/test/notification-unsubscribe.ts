import { ConfigService } from "@nestjs/config";

import type { NotificationCategory } from "@repo/api/domains/notification/notification.schema";

import type { NotificationEmailUnsubscribe } from "../common/modules/email/services/notifications/notifications.service";
import { assertSuccess } from "../common/utils/fp-utils";
import { NotificationUnsubscribeService } from "../notifications/application/services/notification-unsubscribe.service";
import type { TestHarness } from "./test-harness";

/**
 * The footer an email was sent with: the label, the settings link and both unsubscribe links on
 * their bases, and one token in both links that verifies to the recipient and the category.
 */
export function expectUnsubscribeFooter(
  testApp: TestHarness,
  unsubscribe: NotificationEmailUnsubscribe | undefined,
  expected: { recipientId: string; category: NotificationCategory; categoryLabel: string },
): void {
  const config = testApp.module.get(ConfigService);
  const webBaseUrl = config.getOrThrow<string>("email.baseUrl");
  const apiBaseUrl = config.getOrThrow<string>("api.url");
  const token = new URL(unsubscribe?.unsubscribeUrl ?? webBaseUrl).searchParams.get("token") ?? "";

  expect(unsubscribe).toEqual({
    categoryLabel: expected.categoryLabel,
    settingsUrl: new URL("/platform/account/notifications", webBaseUrl).href,
    unsubscribeUrl: new URL(`/unsubscribe?token=${token}`, webBaseUrl).href,
    oneClickUrl: new URL(`/api/v1/notifications/email/unsubscribe/${token}`, apiBaseUrl).href,
  });

  const claims = testApp.module.get(NotificationUnsubscribeService).verify(token);
  assertSuccess(claims);
  expect(claims.value).toEqual({
    userId: expected.recipientId,
    category: expected.category,
    channel: "email",
  });
}
