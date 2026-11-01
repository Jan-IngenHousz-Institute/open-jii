import type { DBAdapter } from "better-auth";
import { APIError } from "better-auth/api";
import { AsyncLocalStorage } from "node:async_hooks";

import { db, eq, organizations, organizationOwnsPrivateResources } from "@repo/database";

import { isPlatformAdmin } from "../platform-admin";

export async function resolveDemoOrganizationUpdate(
  update: { type?: unknown; visibility?: unknown },
  user: { id: string },
  organizationId?: string,
): Promise<{ visibility?: "public" }> {
  const rows = organizationId
    ? await db
        .select({ type: organizations.type, visibility: organizations.visibility })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
    : [];
  const scope = organizationUpdateScope.getStore();
  if (scope && organizationId && rows[0]) {
    scope.current = { id: organizationId, type: rows[0].type };
  }
  const wasDemo = rows.length > 0 && rows[0].type === "demo";
  const becomesDemo = update.type === undefined ? wasDemo : update.type === "demo";
  if (update.type !== undefined && (wasDemo || becomesDemo) && !(await isPlatformAdmin(user))) {
    throw new APIError("FORBIDDEN", { message: "Only a platform admin can set or remove Demo" });
  }
  if (!becomesDemo) return {};
  if (update.visibility !== undefined && update.visibility !== "public") {
    throw new APIError("BAD_REQUEST", { message: "Demo organizations must be public" });
  }
  if (organizationId && !wasDemo) {
    if (await organizationOwnsPrivateResources(db, organizationId)) {
      throw new APIError("BAD_REQUEST", {
        message: "Publish every experiment, workbook, protocol and macro before choosing Demo",
        code: "DEMO_PRIVATE_RESOURCES",
      });
    }
  }
  return { visibility: "public" };
}

interface OrganizationSnapshot {
  id: string;
  type: typeof organizations.$inferSelect.type;
}
const organizationUpdateScope = new AsyncLocalStorage<{ current?: OrganizationSnapshot }>();

export function withDemoOrganizationUpdate<T>(run: () => Promise<T>): Promise<T> {
  return organizationUpdateScope.run({}, async () => {
    try {
      return await run();
    } catch (error) {
      for (let current: unknown = error; typeof current === "object" && current !== null; ) {
        const { code, message, cause } = current as {
          code?: unknown;
          message?: unknown;
          cause?: unknown;
        };
        if (
          code === "23514" &&
          message === "Publish every experiment, workbook, protocol and macro before choosing Demo"
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Publish every experiment, workbook, protocol and macro before choosing Demo",
            code: "DEMO_PRIVATE_RESOURCES",
          });
        }
        if (
          code === "23514" &&
          message === "Demo organizations must be public and cannot be personal workspaces"
        ) {
          throw new APIError("BAD_REQUEST", { message: "Demo organizations must be public" });
        }
        current = cause;
      }
      throw error;
    }
  });
}

/** Match the authorized type in the write, including when another request changed it. */
export function withDemoOrganizationAdapter(adapter: DBAdapter): DBAdapter {
  return {
    ...adapter,
    async update<T>(input: Parameters<DBAdapter["update"]>[0]): Promise<T | null> {
      const current = organizationUpdateScope.getStore()?.current;
      if (input.model !== "organization" || !current) return adapter.update<T>(input);
      const updated = await adapter.update<T>({
        ...input,
        where: [
          ...input.where,
          { field: "id", value: current.id },
          { field: "type", value: current.type },
        ],
      });
      if (!updated) {
        throw new APIError("CONFLICT", {
          message: "The organization changed. Reload it before saving again.",
          code: "ORGANIZATION_CHANGED",
        });
      }
      return updated;
    },
  };
}
