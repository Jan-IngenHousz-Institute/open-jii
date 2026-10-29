import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { DEFAULT_USER_ROLE, PLATFORM_ROLES } from "@repo/database";

/** Every route the admin plugin serves. None is reachable. */
export const DISABLED_ADMIN_PATHS = [
  "/admin/ban-user",
  "/admin/create-user",
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/impersonate-user",
  "/admin/list-user-sessions",
  "/admin/list-users",
  "/admin/remove-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/set-role",
  "/admin/set-user-password",
  "/admin/stop-impersonating",
  "/admin/unban-user",
  "/admin/update-user",
];

const ac = createAccessControl(defaultStatements);

/**
 * The admin plugin for its role and ban columns and its banned-session check. Platform roles
 * change only through the platform-role command, so no role holds a plugin permission and no
 * `adminUserIds` is set, since the plugin lets those users pass every permission check.
 */
export function openJiiAdmin() {
  const plugin = admin({
    ac,
    roles: Object.fromEntries(
      [DEFAULT_USER_ROLE, ...PLATFORM_ROLES].map((role) => [role, ac.newRole({})]),
    ),
    adminRoles: [...PLATFORM_ROLES],
    defaultRole: DEFAULT_USER_ROLE,
  });
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      before: [
        {
          // A route added by a library upgrade stays closed until it is reviewed here.
          matcher: (ctx: { path?: string }) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(() => {
            throw new APIError("NOT_FOUND", { message: "Not found" });
          }),
        },
      ],
    },
  };
}
