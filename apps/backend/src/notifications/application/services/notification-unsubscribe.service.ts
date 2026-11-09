import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

import {
  NOTIFICATION_CATEGORIES,
  zNotificationCategory,
  zNotificationChannel,
} from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationCategory,
  NotificationChannel,
} from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";

const TOKEN_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  requests_and_invitations: "Requests and invitations",
  membership_and_access: "Membership and access",
  experiments_and_resources: "Experiments and resources",
  devices_and_calibration: "Devices and calibration",
  project_transfers: "Project transfers",
  data_jobs: "Data exports and uploads",
  account_security: "Account security",
};

const zSecret = z.string().trim().min(1);

const zTokenPayload = z.object({
  v: z.literal(1),
  u: z.string().guid(),
  c: zNotificationCategory,
  ch: zNotificationChannel,
  exp: z.number().int(),
});

export interface UnsubscribeTokenClaims {
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
}

export interface NotificationUnsubscribeFooter {
  categoryLabel: string;
  settingsUrl: string;
  unsubscribeUrl: string;
  oneClickUrl: string;
}

@Injectable()
export class NotificationUnsubscribeService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.getOrThrow<string>("notification.unsubscribeSecret");
    // getOrThrow lets an empty string through, which is what an unset deploy secret becomes.
    if (!zSecret.safeParse(secret).success) {
      throw new Error(
        "Invalid notification configuration: NOTIFICATION_UNSUBSCRIBE_SECRET is empty",
      );
    }
    this.key = Buffer.from(secret);
  }

  sign(userId: string, category: NotificationCategory, expiresAt?: Date): string {
    const exp = Math.floor((expiresAt?.getTime() ?? Date.now() + TOKEN_LIFETIME_MS) / 1000);
    const payload = Buffer.from(JSON.stringify({ v: 1, u: userId, c: category, ch: "email", exp }));
    return `${payload.toString("base64url")}.${this.signature(payload)}`;
  }

  verify(token: string): Result<UnsubscribeTokenClaims> {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return this.invalidLink();
    }
    const [encodedPayload, providedSignature] = parts;
    const payload = Buffer.from(encodedPayload, "base64url");

    // Compared as the canonical encoding: base64url's last character carries unused bits, so a
    // decoded comparison would accept a signature with that character changed.
    const expected = Buffer.from(this.signature(payload));
    const provided = Buffer.from(providedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return this.invalidLink();
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload.toString("utf8"));
    } catch {
      return this.invalidLink();
    }
    const parsed = zTokenPayload.safeParse(decoded);
    if (!parsed.success) {
      return this.invalidLink();
    }

    const { u: userId, c: category, ch: channel, exp } = parsed.data;
    if (exp * 1000 <= Date.now()) {
      return this.invalidLink();
    }
    if (NOTIFICATION_CATEGORIES[category][channel].locked) {
      return this.invalidLink();
    }

    return success({ userId, category, channel });
  }

  footerFor(userId: string, category: NotificationCategory): NotificationUnsubscribeFooter {
    const token = this.sign(userId, category);
    const webBaseUrl = this.configService.getOrThrow<string>("email.baseUrl");
    const apiBaseUrl = this.configService.getOrThrow<string>("api.url");

    return {
      categoryLabel: NOTIFICATION_CATEGORY_LABEL[category],
      settingsUrl: new URL("/platform/account/notifications", webBaseUrl).toString(),
      unsubscribeUrl: new URL(
        `/unsubscribe?token=${encodeURIComponent(token)}`,
        webBaseUrl,
      ).toString(),
      oneClickUrl: new URL(
        `/api/v1/notifications/email/unsubscribe/${encodeURIComponent(token)}`,
        apiBaseUrl,
      ).toString(),
    };
  }

  /** One refusal for every reason a link fails, so a caller cannot tell which check it was. */
  invalidLink(): Result<never> {
    return failure(
      AppError.badRequest(
        "Unsubscribe link is invalid or expired",
        ErrorCodes.NOTIFICATION_UNSUBSCRIBE_LINK_INVALID,
      ),
    );
  }

  private signature(payload: Buffer): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}
