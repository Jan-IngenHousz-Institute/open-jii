import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin } from "better-auth/plugins";

import { db, and, eq, isNull, profiles, users } from "@repo/database";

import { configuredAdminUserIds, isPlatformAdmin } from "../platform-admin";

export const ALLOWED_ADMIN_PATHS = ["/admin/set-role"] as const;
export const DISABLED_ADMIN_PATHS = [
  "/admin/list-users",
  "/admin/get-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-user-sessions",
  "/admin/unban-user",
  "/admin/ban-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/has-permission",
];

function roleChange(body: unknown): { userId: string; role: "admin" | "user" } {
  if (
    typeof body !== "object" ||
    body === null ||
    !("userId" in body) ||
    !("role" in body) ||
    typeof body.userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId) ||
    (body.role !== "admin" && body.role !== "user")
  ) {
    throw new APIError("BAD_REQUEST", { message: "Choose a user UUID and role admin or user" });
  }
  return { userId: body.userId.toLowerCase(), role: body.role };
}

export function openJiiAdmin(adminUserIds: string[] = configuredAdminUserIds) {
  const plugin = admin({ adminUserIds });
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (!ALLOWED_ADMIN_PATHS.some((path) => path === ctx.path)) {
              throw new APIError("NOT_FOUND", { message: "Not found" });
            }
            const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
            if (!session || !(await isPlatformAdmin(session.user, ctx.headers, adminUserIds))) {
              throw new APIError("FORBIDDEN", { message: "Platform admin access required" });
            }
            if (ctx.path !== "/admin/set-role") return;
            const body = roleChange(ctx.body);
            ctx.body = body;
            if (
              body.userId === session.user.id.toLowerCase() ||
              adminUserIds.includes(body.userId)
            ) {
              throw new APIError("FORBIDDEN", {
                message: "You cannot change your own role or an admin set by configuration",
              });
            }
            const targets = await db
              .select({ registered: users.registered, role: users.role })
              .from(users)
              .leftJoin(profiles, eq(profiles.userId, users.id))
              .where(
                and(
                  eq(users.id, body.userId),
                  eq(users.isAnonymous, false),
                  isNull(profiles.deletedAt),
                ),
              )
              .limit(1);
            if (targets.length === 0 || !targets[0].registered) {
              throw new APIError("BAD_REQUEST", { message: "Choose a registered researcher" });
            }
            if ((targets[0].role ?? "user") === body.role) {
              throw new APIError("BAD_REQUEST", {
                message: "The researcher already has this role",
              });
            }
          }),
        },
      ],
      after: [
        ...plugin.hooks.after,
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/admin/set-role",
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.context.returned instanceof APIError) return;
            const body = roleChange(ctx.body);
            ctx.context.returned = { user: { id: body.userId, role: body.role } };
            const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
            if (!session) return;
            ctx.context.logger.info("Platform admin role changed", {
              actorId: session.user.id.toLowerCase(),
              targetId: body.userId,
              action: body.role === "admin" ? "appoint" : "remove",
              timestamp: new Date().toISOString(),
            });
          }),
        },
      ],
    },
  };
}
