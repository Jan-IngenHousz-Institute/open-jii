import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { protocols } from "../../src/schema";
import type { SeedUser } from "./types";

/** Measurement protocols, and the macros each one runs. */
export async function seedProtocols(user: SeedUser, personalOrganizationId: string) {
  // 2. Create protocols (10 total — 6 multispeq, 4 ambyte; some with sortOrder)
  const protocolData: {
    name: string;
    description: string;
    family: "multispeq" | "ambyte";
    code: Record<string, unknown>[];
    sortOrder?: number;
  }[] = [
    {
      name: "[Seed] Chlorophyll Fluorescence v1",
      description:
        "Measures chlorophyll fluorescence using the MultispeQ device to assess photosynthetic efficiency and Phi2 quantum yield.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "Phi2", pulses: [20, 50, 20] }] }],
      sortOrder: 1,
    },
    {
      name: "[Seed] Leaf Thickness Measurement",
      description:
        "Measures leaf thickness and relative chlorophyll content for plant health screening.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "Thickness", pulses: [10, 30] }] }],
      sortOrder: 2,
    },
    {
      name: "[Seed] SPAD Chlorophyll Index",
      description:
        "Estimates SPAD chlorophyll index values from dual-wavelength absorbance readings.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "SPAD", wavelengths: [650, 940] }] }],
      sortOrder: 3,
    },
    {
      name: "[Seed] Photosynthetically Active Radiation",
      description:
        "Measures PAR (400-700nm) intensity at the leaf surface for light environment characterization.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "PAR", range: [400, 700], sample_rate: 5 }] }],
      sortOrder: 4,
    },
    {
      name: "[Seed] Electrochromic Shift (ECS)",
      description:
        "Measures the electrochromic shift signal to estimate thylakoid proton motive force.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "ECS", pulses: [10, 20, 10], dark_interval: 5 }] }],
      sortOrder: 5,
    },
    {
      name: "[Seed] Leaf Reflectance NDVI",
      description:
        "Calculates Normalized Difference Vegetation Index from red and near-infrared reflectance.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "NDVI", wavelengths: [660, 850] }] }],
      sortOrder: 6,
    },
    {
      name: "[Seed] Soil Moisture Probe",
      description:
        "Reads soil moisture and temperature sensors through an Ambyte gateway at configurable depth intervals.",
      family: "ambyte",
      code: [{ _protocol_set: [{ label: "SoilMoisture", interval: 5, depth_cm: 15 }] }],
      sortOrder: 1,
    },
    {
      name: "[Seed] Ambient Light & Temperature",
      description:
        "Reads ambient PAR, UV index, and air temperature sensors through an Ambyte gateway.",
      family: "ambyte",
      code: [{ _protocol_set: [{ label: "AmbientEnv", sample_rate: 10 }] }],
      sortOrder: 2,
    },
    {
      name: "[Seed] Soil EC & pH Logger",
      description:
        "Logs electrical conductivity and pH in soil solution for nutrient availability monitoring.",
      family: "ambyte",
      code: [{ _protocol_set: [{ label: "SoilEC", interval: 30 }] }],
      sortOrder: 3,
    },
    {
      name: "[Seed] Canopy Temperature Monitor",
      description:
        "Infrared canopy temperature monitoring for crop water stress index calculations.",
      family: "ambyte",
      code: [{ _protocol_set: [{ label: "CanopyTemp", ir_emissivity: 0.95, interval: 60 }] }],
      sortOrder: 4,
    },
  ];

  const createdProtocols = await db
    .insert(protocols)
    .values(
      protocolData.map((p) => ({
        ...p,
        createdBy: user.id,
        organizationId: personalOrganizationId,
      })),
    )
    .returning();

  console.log(`  Created ${createdProtocols.length} protocols`);

  return createdProtocols;
}
