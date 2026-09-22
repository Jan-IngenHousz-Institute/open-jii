import { and, or } from "drizzle-orm";

import { db } from "../../src/database";
import { flows, iotDevices } from "../../src/schema";
import type { SeedUser } from "./types";

/** Devices across families and statuses; nothing here talks to AWS. */
export async function seedDevices(user: SeedUser, personalOrganizationId: string) {
  // 8. IoT devices across families and statuses. Thing/cert identifiers are
  // fakes; nothing here talks to AWS, so credential flows (issue, rotate,
  // revoke) still need a real device or localstack.
  const certFor = (slug: string) => ({
    certificateId: `seed-cert-${slug}`,
    certificateArn: `arn:aws:iot:local:000000000000:cert/seed-cert-${slug}`,
  });

  // A calibration session refuses to run on a unit whose reported identifier is not the
  // device's registered serial, so a family that announces a MAC is seeded with one.
  const deviceSeeds: {
    slug: string;
    name: string;
    deviceType: "multispeq" | "ambyte" | "ambit" | "minipar" | "mobile";
    status: "registered" | "active" | "revoked" | "retired";
    serialNumber?: string;
  }[] = [
    {
      slug: "ambyte-gw-01",
      name: "[Seed] Ambyte Field Gateway 01",
      deviceType: "ambyte",
      status: "active",
    },
    {
      slug: "ambyte-gw-02",
      name: "[Seed] Ambyte Field Gateway 02",
      deviceType: "ambyte",
      status: "registered",
    },
    {
      slug: "multispeq-01",
      name: "[Seed] MultispeQ Handheld 01",
      deviceType: "multispeq",
      status: "active",
    },
    {
      slug: "ambit-01",
      name: "[Seed] Ambit Logger 01",
      deviceType: "ambit",
      status: "active",
      serialNumber: "A0:B1:C2:D3:E4:F5",
    },
    {
      slug: "minipar-01",
      name: "[Seed] MiniPAR Sensor 01",
      deviceType: "minipar",
      status: "active",
    },
    { slug: "retired-gw", name: "[Seed] Retired Gateway", deviceType: "ambyte", status: "retired" },
  ];

  const createdDevices = await db
    .insert(iotDevices)
    .values(
      deviceSeeds.map((d, index) => ({
        thingName: `seed-${d.slug}`,
        thingArn: `arn:aws:iot:local:000000000000:thing/seed-${d.slug}`,
        serialNumber: d.serialNumber ?? `SEED-SN-${String(index + 1).padStart(4, "0")}`,
        name: d.name,
        deviceType: d.deviceType,
        status: d.status,
        ...(d.status === "active" ? certFor(d.slug) : {}),
        organizationId: personalOrganizationId,
        createdBy: user.id,
      })),
    )
    .returning();

  console.log(`  Created ${createdDevices.length} IoT devices`);

  return createdDevices;
}
