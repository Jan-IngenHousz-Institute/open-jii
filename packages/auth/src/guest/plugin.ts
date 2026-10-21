import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { expireCookie, parseCookies } from "better-auth/cookies";
import { anonymous } from "better-auth/plugins";

import { isDemoModeEnabled } from "@repo/analytics/server";
import { GUEST_EMAIL_DOMAIN, zGuestName } from "@repo/api/shared/guest";

import { isGuestRecipient } from "./recipient";

export async function demoModeEnabled(): Promise<boolean> {
  return isDemoModeEnabled();
}

export const GUEST_AUTH_PATHS = ["/get-session", "/sign-out", "/update-user"] as const;

function guestName(value: unknown): string {
  const parsed = zGuestName.safeParse(value ?? "");
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_GUEST_NAME",
      message: "Use a name of at most 60 characters without a web address",
    });
  }
  return parsed.data;
}

function bodyFields(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function openJiiGuest({
  isDemoEnabled = demoModeEnabled,
}: { isDemoEnabled?: () => Promise<boolean> } = {}) {
  const plugin = anonymous({
    emailDomainName: GUEST_EMAIL_DOMAIN,
    disableDeleteAnonymousUser: true,
    generateName: (ctx) => Promise.resolve(guestName(bodyFields(ctx.body).name)),
  });
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const body = bodyFields(ctx.body);
            if (typeof body.email === "string" && (await isGuestRecipient(body.email))) {
              throw new APIError("FORBIDDEN", { message: "This address cannot be used" });
            }
            let session = await getSessionFromCtx(ctx);
            if (
              session?.user.isAnonymous &&
              (ctx.path === "/get-session" || ctx.path === "/update-user")
            ) {
              // Cached guest cookies cannot renew a session whose account was purged.
              ctx.context.session = null;
              if (ctx.path === "/get-session") {
                return { context: { query: { ...ctx.query, disableCookieCache: true } } };
              }
              session = await getSessionFromCtx(ctx, { disableCookieCache: true });
              if (!session)
                throw new APIError("UNAUTHORIZED", { message: "This guest session has ended" });
            }
            if (ctx.path === "/sign-in/anonymous") {
              if (session?.user.isAnonymous) {
                // Keep the installed plugin's re-entry response; it creates no second user.
                return;
              }
              if (session) {
                throw new APIError("FORBIDDEN", {
                  message: "Sign out before starting a guest session",
                });
              }
              if (!(await isDemoEnabled())) {
                throw new APIError("FORBIDDEN", {
                  code: "DEMO_DISABLED",
                  message: "The demo is currently unavailable",
                });
              }
              guestName(body.name);
              return;
            }
            if (!session?.user.isAnonymous) return;
            if (!GUEST_AUTH_PATHS.some((path) => path === ctx.path)) {
              throw new APIError("FORBIDDEN", {
                code: "GUEST_ACTION_FORBIDDEN",
                message: "This action is not available to guests",
              });
            }
            if (ctx.path === "/update-user") {
              if (Object.keys(body).length !== 1 || !("name" in body)) {
                throw new APIError("FORBIDDEN", { message: "Guests can only change their name" });
              }
              return { context: { body: { name: guestName(body.name) } } };
            }
          }),
        },
      ],
      after: [
        ...plugin.hooks.after,
        {
          matcher: () => true,
          handler: createAuthMiddleware((ctx) => {
            if (!ctx.request) return Promise.resolve();
            const returned: unknown = ctx.context.returned;
            if (!returned || typeof returned !== "object") return Promise.resolve();
            const user =
              "user" in returned
                ? returned.user
                : ctx.path === "/update-user"
                  ? ctx.context.session?.user
                  : undefined;
            if (
              !user ||
              typeof user !== "object" ||
              !("isAnonymous" in user) ||
              !user.isAnonymous
            ) {
              return Promise.resolve();
            }
            // Keep the signed session token, but never persist a guest identity snapshot.
            const cache = ctx.context.authCookies.sessionData;
            const cookieNames = new Set([
              cache.name,
              ...parseCookies(ctx.headers?.get("cookie") ?? "").keys(),
              ...(ctx.context.responseHeaders?.getSetCookie() ?? []).map((cookie) =>
                cookie.slice(0, cookie.indexOf("=")),
              ),
            ]);
            for (const name of cookieNames) {
              if (name === cache.name || name.startsWith(`${cache.name}.`)) {
                expireCookie(ctx, { ...cache, name });
              }
            }
            if ("user" in returned) {
              const { email: _email, ...safeUser } = user as Record<string, unknown>;
              ctx.context.returned = { ...returned, user: safeUser };
            }
            return Promise.resolve();
          }),
        },
      ],
    },
  };
}
