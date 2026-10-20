import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { eq, notifications } from "@repo/database";

import { queuedDeliveriesFor } from "./notification-deliveries";
import type { QueuedDelivery } from "./notification-deliveries";
import type { TestHarness } from "./test-harness";

/**
 * The people a deletion or a move reaches, for producer specs: the owner of the
 * organization that owns the resource, an admin and a viewer grantee, and the
 * acting admin, who must hear nothing.
 */
export interface ResourceAudience {
  organizationId: string;
  owner: string;
  actor: string;
  admin: string;
  viewer: string;
}

/** The organization and its people. Build the resource into `organizationId`, then grant. */
export async function seedResourceAudience(testApp: TestHarness): Promise<ResourceAudience> {
  const organizationId = await testApp.createOrganization();
  const owner = await testApp.createTestUser({ name: "Org Owner" });
  await testApp.addOrganizationMember(organizationId, owner, "owner");

  return {
    organizationId,
    owner,
    actor: await testApp.createTestUser({ name: "Acting Admin" }),
    admin: await testApp.createTestUser({ name: "Grant Admin" }),
    viewer: await testApp.createTestUser({ name: "Grant Viewer" }),
  };
}

export async function grantResourceAudience(
  testApp: TestHarness,
  audience: ResourceAudience,
  resourceType: SharingResourceType,
  resourceId: string,
): Promise<void> {
  for (const [granteeId, role] of [
    [audience.actor, "admin"],
    [audience.admin, "admin"],
    [audience.viewer, "viewer"],
  ] as const) {
    await testApp.addResourceGrant({
      resourceType,
      resourceId,
      granteeType: "user",
      granteeId,
      role,
    });
  }
}

/** One person's notification rows, as the columns a producer decides. */
export async function notificationsFor(testApp: TestHarness, recipientId: string) {
  return testApp.database
    .select({
      type: notifications.type,
      recipientId: notifications.recipientId,
      actorId: notifications.actorId,
      resourceType: notifications.resourceType,
      resourceId: notifications.resourceId,
      params: notifications.params,
    })
    .from(notifications)
    .where(eq(notifications.recipientId, recipientId));
}

export function deliveriesFor(
  testApp: TestHarness,
  recipientId: string,
): Promise<QueuedDelivery[]> {
  return queuedDeliveriesFor(testApp.database, recipientId);
}

type Person = Exclude<keyof ResourceAudience, "organizationId">;
const PEOPLE: readonly Person[] = ["owner", "actor", "admin", "viewer"];

type NotificationRow = Awaited<ReturnType<typeof notificationsFor>>[number];

/** Every person's rows, keyed by who they are, so a failing case names the person. */
export async function audienceNotifications(
  testApp: TestHarness,
  audience: ResourceAudience,
): Promise<Record<Person, NotificationRow[]>> {
  const rows = await Promise.all(
    PEOPLE.map((person) => notificationsFor(testApp, audience[person])),
  );
  return Object.fromEntries(PEOPLE.map((person, i) => [person, rows[i]])) as Record<
    Person,
    NotificationRow[]
  >;
}

export async function audienceDeliveries(
  testApp: TestHarness,
  audience: ResourceAudience,
): Promise<Record<Person, Pick<QueuedDelivery, "type" | "status">[]>> {
  const rows = await Promise.all(PEOPLE.map((person) => deliveriesFor(testApp, audience[person])));
  return Object.fromEntries(
    PEOPLE.map((person, i) => [person, rows[i].map(({ type, status }) => ({ type, status }))]),
  ) as Record<Person, Pick<QueuedDelivery, "type" | "status">[]>;
}

/** What the owner, the admin and the viewer should each hold; the actor holds nothing. */
export function heardByAllButTheActor<T>(
  audience: ResourceAudience,
  each: (recipientId: string) => T,
): Record<Person, T[]> {
  return {
    owner: [each(audience.owner)],
    actor: [],
    admin: [each(audience.admin)],
    viewer: [each(audience.viewer)],
  };
}
