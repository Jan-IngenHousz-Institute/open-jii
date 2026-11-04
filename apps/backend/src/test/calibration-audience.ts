import { notificationsFor, deliveriesFor } from "./resource-audience";
import type { TestHarness } from "./test-harness";

/**
 * The people a calibration run notification can reach, for producer specs: the
 * owner of the organization that owns the device, a Can edit and a Can view
 * grantee, a plain member of the organization and the person who ran it.
 */
export interface CalibrationAudience {
  organizationId: string;
  deviceId: string;
  owner: string;
  manager: string;
  viewer: string;
  member: string;
  requester: string;
}

/** A device in a fresh organization, its grants, and the requester, who holds none. */
export async function seedCalibrationAudience(
  testApp: TestHarness,
  device: { name?: string | null; serialNumber?: string } = {},
): Promise<CalibrationAudience> {
  const organizationId = await testApp.createOrganization();
  const owner = await testApp.createTestUser({ name: "Org Owner" });
  await testApp.addOrganizationMember(organizationId, owner, "owner");
  const member = await testApp.createTestUser({ name: "Org Member" });
  await testApp.addOrganizationMember(organizationId, member, "member");

  const { id: deviceId } = await testApp.createIotDevice({
    ...device,
    deviceType: "minipar",
    createdBy: owner,
    organizationId,
  });

  const manager = await testApp.createTestUser({ name: "Device Manager" });
  const viewer = await testApp.createTestUser({ name: "Device Viewer" });
  for (const [granteeId, role] of [
    [manager, "admin"],
    [viewer, "viewer"],
  ] as const) {
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: deviceId,
      granteeType: "user",
      granteeId,
      role,
    });
  }

  return {
    organizationId,
    deviceId,
    owner,
    manager,
    viewer,
    member,
    requester: await testApp.createTestUser({ name: "Bench Operator" }),
  };
}

type Person = Exclude<keyof CalibrationAudience, "organizationId" | "deviceId">;
const PEOPLE: readonly Person[] = ["owner", "manager", "viewer", "member", "requester"];

type NotificationRow = Awaited<ReturnType<typeof notificationsFor>>[number];

/** Every person's rows, keyed by who they are, so a failing case names the person. */
export async function calibrationNotifications(
  testApp: TestHarness,
  audience: CalibrationAudience,
): Promise<Record<Person, NotificationRow[]>> {
  const rows = await Promise.all(
    PEOPLE.map((person) => notificationsFor(testApp, audience[person])),
  );
  return Object.fromEntries(PEOPLE.map((person, i) => [person, rows[i]])) as Record<
    Person,
    NotificationRow[]
  >;
}

export async function calibrationDeliveries(
  testApp: TestHarness,
  audience: CalibrationAudience,
): Promise<Record<Person, { type: string; status: string }[]>> {
  const rows = await Promise.all(PEOPLE.map((person) => deliveriesFor(testApp, audience[person])));
  return Object.fromEntries(
    PEOPLE.map((person, i) => [person, rows[i].map(({ type, status }) => ({ type, status }))]),
  ) as Record<Person, { type: string; status: string }[]>;
}

/** What each person should hold, given the ones who hear; everyone else holds nothing. */
export function heardBy<T>(
  audience: CalibrationAudience,
  recipients: readonly Person[],
  each: (recipientId: string) => T,
): Record<Person, T[]> {
  return Object.fromEntries(
    PEOPLE.map((person) => [person, recipients.includes(person) ? [each(audience[person])] : []]),
  ) as Record<Person, T[]>;
}
