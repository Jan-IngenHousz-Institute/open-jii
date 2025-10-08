import { eq } from "drizzle-orm";

import { SYSTEM_OWNER_ID } from "./constants";
import { db } from "./database";
import { users, profiles } from "./schema";

export async function seedSystemOwner(): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.id, SYSTEM_OWNER_ID)).limit(1);

  if (existing.length === 0) {
    console.log("Creating system owner account...");

    await db.insert(users).values({
      id: SYSTEM_OWNER_ID,
      name: "System",
      email: "system@openjii.internal",
      registered: true,
      emailVerified: new Date(),
    });

    await db.insert(profiles).values({
      userId: SYSTEM_OWNER_ID,
      firstName: "System",
      lastName: "Owner",
      bio: "System account for managing orphaned content",
      activated: false, // Keep inactive by default so the account appears as "Unknown User" on the platform
    });

    console.log("System owner account created successfully");
  } else {
    console.log("System owner account already exists");
  }
}
