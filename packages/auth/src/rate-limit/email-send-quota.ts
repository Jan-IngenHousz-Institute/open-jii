import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod/v4";

import type { DbOrTx } from "@repo/database";

import { consumeRateLimitCounter } from "./rate-limit.repository";
import { hashRateLimitIdentity } from "./storage";

export const OTP_SEND_PATHS = [
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
];
export const EMAIL_SEND_RULE = "otp:send";

const sendBody = z.object({ email: z.email(), type: z.string().optional() });

export function emailSendQuota(database: DbOrTx, secret: () => string): BetterAuthPlugin {
  return {
    id: "openjii-email-send-quota",
    hooks: {
      before: [
        {
          matcher: (ctx) => OTP_SEND_PATHS.includes(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const result = sendBody.safeParse(ctx.body);
            if (!result.success) return;
            if (
              ctx.path === "/email-otp/send-verification-otp" &&
              !["sign-in", "email-verification", "forget-password"].includes(result.data.type ?? "")
            )
              return;
            const quota = await consumeRateLimitCounter(database, {
              key: hashRateLimitIdentity(secret(), "email", result.data.email.toLowerCase()),
              route: EMAIL_SEND_RULE,
              now: new Date(),
              window: 900,
              max: 5,
              sliding: false,
            });
            if (!quota.allowed) {
              throw new APIError(
                "TOO_MANY_REQUESTS",
                {
                  code: "OTP_SEND_RATE_LIMITED",
                  message: "Too many code requests. Please try again later.",
                },
                { "Retry-After": String(quota.retryAfter) },
              );
            }
          }),
        },
      ],
    },
  };
}
