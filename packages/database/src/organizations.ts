import { eq } from "drizzle-orm";

import type { DatabaseInstance } from "./database";
import { organizationMembers, organizations } from "./schema";

/** Deterministic, collision-free slug for a user's personal organization. */
export function personalOrgSlug(userId: string): string {
  return `personal-${userId}`;
}

/** Display name for a user's personal organization. */
export function personalOrgName(userName?: string | null): string {
  const trimmed = userName?.trim();
  return trimmed ? `${trimmed}'s workspace` : "Personal workspace";
}

/**
 * Idempotently ensure the user owns a personal organization and is its owner.
 * Returns the organization id. Safe to call on every sign-in.
 */
export async function ensurePersonalOrganization(
  db: DatabaseInstance,
  user: { id: string; name?: string | null },
): Promise<string> {
  const slug = personalOrgSlug(user.id);

  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  let organizationId = existing[0]?.id;
  if (!organizationId) {
    const [org] = await db
      .insert(organizations)
      .values({ name: personalOrgName(user.name), slug })
      .returning({ id: organizations.id });
    organizationId = org.id;
  }

  await db
    .insert(organizationMembers)
    .values({ organizationId, userId: user.id, role: "owner" })
    .onConflictDoNothing();

  return organizationId;
}
