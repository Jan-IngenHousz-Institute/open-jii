import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { deviceGroupMembers, deviceGroups } from "../../src/schema";
import type { SeedDevice, SeedUser } from "./types";

/** One populated fleet and one empty group, so both states have a page. */
export async function seedDeviceGroups(
  user: SeedUser,
  personalOrganizationId: string,
  createdDevices: SeedDevice[],
) {
  const d = createdDevices;
  // 10. Device groups: one working fleet and one empty group, so the Groups
  // tab shows both a populated roster and the empty state on a detail page.
  const createdGroups = await db
    .insert(deviceGroups)
    .values([
      {
        name: "[Seed] Greenhouse A",
        description: "The active field fleet: gateways plus the handheld.",
        organizationId: personalOrganizationId,
        createdBy: user.id,
      },
      {
        name: "[Seed] Loaner pool",
        description: "Devices waiting to be handed out.",
        organizationId: personalOrganizationId,
        createdBy: user.id,
      },
    ])
    .returning();

  await db.insert(deviceGroupMembers).values(
    [d[0], d[1], d[2]].map((device) => ({
      groupId: createdGroups[0].id,
      deviceId: device.id,
      addedBy: user.id,
    })),
  );
  console.log(`  Created ${createdGroups.length} device groups (3 members in the first)`);
}
