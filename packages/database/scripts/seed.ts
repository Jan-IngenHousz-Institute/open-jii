import { eq, like, inArray } from "drizzle-orm";

import { db } from "../src/database";
import {
  users,
  profiles,
  protocols,
  macros,
  protocolMacros,
  experiments,
  experimentMembers,
  flows,
} from "../src/schema";

const SEED_EMAIL = "seed@openjii.local";
const SEED_PREFIX = "[Seed]%";

async function clearSeedData() {
  // Find seed experiment IDs for join table cleanup
  const seedExperiments = await db.select({ id: experiments.id }).from(experiments).where(like(experiments.name, SEED_PREFIX));
  const seedExpIds = seedExperiments.map((e) => e.id);

  if (seedExpIds.length > 0) {
    // Delete experimentMembers (no cascade) before experiments
    await db.delete(experimentMembers).where(inArray(experimentMembers.experimentId, seedExpIds));
    // Experiments cascade-delete: flows
    await db.delete(experiments).where(inArray(experiments.id, seedExpIds));
  }

  // Protocols cascade-delete protocolMacros
  await db.delete(protocols).where(like(protocols.name, SEED_PREFIX));
  await db.delete(macros).where(like(macros.name, SEED_PREFIX));

  // User + profile
  const seedUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, SEED_EMAIL));
  if (seedUsers.length > 0) {
    await db.delete(profiles).where(eq(profiles.userId, seedUsers[0].id));
    await db.delete(users).where(eq(users.id, seedUsers[0].id));
  }
}

async function main() {
  console.log("Clearing previous seed data...");
  await clearSeedData();

  console.log("Seeding local database...");

  // 1. Create seed user + profile
  const [user] = await db
    .insert(users)
    .values({
      name: "Seed User",
      email: SEED_EMAIL,
      emailVerified: true,
      registered: true,
    })
    .returning();

  await db.insert(profiles).values({
    userId: user.id,
    firstName: "Seed",
    lastName: "User",
    activated: true,
  });

  console.log(`  Created user: ${user.id}`);

  // 2. Create protocols (10 total — 6 multispeq, 4 ambit; some with sortOrder)
  const protocolData: {
    name: string;
    description: string;
    family: "multispeq" | "ambit";
    code: Record<string, unknown>[];
    sortOrder?: number;
  }[] = [
    {
      name: "[Seed] Chlorophyll Fluorescence v1",
      description: "Measures chlorophyll fluorescence using the MultispeQ sensor to assess photosynthetic efficiency and Phi2 quantum yield.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "Phi2", pulses: [20, 50, 20] }] }],
      sortOrder: 1,
    },
    {
      name: "[Seed] Leaf Thickness Measurement",
      description: "Measures leaf thickness and relative chlorophyll content for plant health screening.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "Thickness", pulses: [10, 30] }] }],
      sortOrder: 2,
    },
    {
      name: "[Seed] SPAD Chlorophyll Index",
      description: "Estimates SPAD chlorophyll index values from dual-wavelength absorbance readings.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "SPAD", wavelengths: [650, 940] }] }],
      sortOrder: 3,
    },
    {
      name: "[Seed] Photosynthetically Active Radiation",
      description: "Measures PAR (400-700nm) intensity at the leaf surface for light environment characterization.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "PAR", range: [400, 700], sample_rate: 5 }] }],
      sortOrder: 4,
    },
    {
      name: "[Seed] Electrochromic Shift (ECS)",
      description: "Measures the electrochromic shift signal to estimate thylakoid proton motive force.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "ECS", pulses: [10, 20, 10], dark_interval: 5 }] }],
      sortOrder: 5,
    },
    {
      name: "[Seed] Leaf Reflectance NDVI",
      description: "Calculates Normalized Difference Vegetation Index from red and near-infrared reflectance.",
      family: "multispeq",
      code: [{ _protocol_set: [{ label: "NDVI", wavelengths: [660, 850] }] }],
      sortOrder: 6,
    },
    {
      name: "[Seed] Soil Moisture Probe",
      description: "Ambit-based soil moisture and temperature measurement at configurable depth intervals.",
      family: "ambit",
      code: [{ _protocol_set: [{ label: "SoilMoisture", interval: 5, depth_cm: 15 }] }],
      sortOrder: 1,
    },
    {
      name: "[Seed] Ambient Light & Temperature",
      description: "Reads ambient PAR, UV index, and air temperature using an Ambit environmental sensor array.",
      family: "ambit",
      code: [{ _protocol_set: [{ label: "AmbientEnv", sample_rate: 10 }] }],
      sortOrder: 2,
    },
    {
      name: "[Seed] Soil EC & pH Logger",
      description: "Logs electrical conductivity and pH in soil solution for nutrient availability monitoring.",
      family: "ambit",
      code: [{ _protocol_set: [{ label: "SoilEC", interval: 30 }] }],
      sortOrder: 3,
    },
    {
      name: "[Seed] Canopy Temperature Monitor",
      description: "Infrared canopy temperature monitoring for crop water stress index calculations.",
      family: "ambit",
      code: [{ _protocol_set: [{ label: "CanopyTemp", ir_emissivity: 0.95, interval: 60 }] }],
      sortOrder: 4,
    },
  ];

  const createdProtocols = await db
    .insert(protocols)
    .values(protocolData.map((p) => ({ ...p, createdBy: user.id })))
    .returning();

  console.log(`  Created ${createdProtocols.length} protocols`);

  // 3. Create macros (12 total — 5 python, 3 javascript, 2 r; some with sortOrder)
  const macroData: {
    name: string;
    language: "python" | "javascript" | "r";
    description: string;
    code: string;
    sortOrder?: number;
  }[] = [
    {
      name: "[Seed] Phi2 Quantum Yield",
      language: "python",
      description: "Calculates Phi2 quantum yield of photosystem II from fluorescence trace data.",
      code: btoa("import numpy as np\n\ndef analyze(data):\n    fm_prime = data['Fm_prime']\n    fs = data['Fs']\n    return {'Phi2': (fm_prime - fs) / fm_prime}\n"),
      sortOrder: 1,
    },
    {
      name: "[Seed] SPAD Estimator",
      language: "python",
      description: "Estimates SPAD chlorophyll values from dual-wavelength absorbance measurements.",
      code: btoa("def estimate_spad(abs_650, abs_940):\n    ratio = abs_650 / abs_940\n    return ratio * 45.2 + 1.3\n"),
      sortOrder: 2,
    },
    {
      name: "[Seed] ECS Decay Analysis",
      language: "python",
      description: "Fits exponential decay curves to electrochromic shift signals for pmf estimation.",
      code: btoa("import numpy as np\nfrom scipy.optimize import curve_fit\n\ndef ecs_decay(t, a, tau):\n    return a * np.exp(-t / tau)\n"),
      sortOrder: 3,
    },
    {
      name: "[Seed] Outlier Detection",
      language: "python",
      description: "Flags statistical outliers in measurement datasets using IQR method.",
      code: btoa("import numpy as np\n\ndef flag_outliers(values):\n    q1, q3 = np.percentile(values, [25, 75])\n    iqr = q3 - q1\n    return (values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)\n"),
      sortOrder: 4,
    },
    {
      name: "[Seed] NDVI Calculator",
      language: "python",
      description: "Computes NDVI from red and NIR reflectance bands.",
      code: btoa("def ndvi(red, nir):\n    return (nir - red) / (nir + red)\n"),
      sortOrder: 5,
    },
    {
      name: "[Seed] Data Formatter",
      language: "javascript",
      description: "Formats raw sensor output into a standardized JSON structure with timestamps.",
      code: btoa("function format(raw) {\n  return {\n    timestamp: Date.now(),\n    values: raw,\n    version: '1.0'\n  };\n}\n"),
      sortOrder: 6,
    },
    {
      name: "[Seed] Unit Converter",
      language: "javascript",
      description: "Converts measurement units between metric and imperial for field data.",
      code: btoa("const conversions = {\n  cm_to_in: v => v * 0.3937,\n  c_to_f: v => v * 9/5 + 32,\n  kpa_to_psi: v => v * 0.14504\n};\n"),
      sortOrder: 7,
    },
    {
      name: "[Seed] Geolocation Tagger",
      language: "javascript",
      description: "Attaches GPS coordinates and location metadata to measurement records.",
      code: btoa("function tagLocation(record, lat, lon) {\n  return { ...record, location: { lat, lon, tagged_at: new Date().toISOString() } };\n}\n"),
      sortOrder: 8,
    },
    {
      name: "[Seed] Statistical Summary",
      language: "r",
      description: "Generates summary statistics (mean, median, sd, min, max) for all measurement columns.",
      code: btoa("summary_stats <- function(df) {\n  sapply(df, function(x) c(mean=mean(x), median=median(x), sd=sd(x), min=min(x), max=max(x)))\n}\n"),
      sortOrder: 9,
    },
    {
      name: "[Seed] ANOVA Analysis",
      language: "r",
      description: "Performs one-way ANOVA and Tukey HSD post-hoc tests across treatment groups.",
      code: btoa("run_anova <- function(df, response, treatment) {\n  model <- aov(as.formula(paste(response, '~', treatment)), data=df)\n  list(anova=summary(model), tukey=TukeyHSD(model))\n}\n"),
      sortOrder: 10,
    },
  ];

  const createdMacros = [];
  for (const m of macroData) {
    const macroId = crypto.randomUUID();
    const [macro] = await db
      .insert(macros)
      .values({
        id: macroId,
        name: m.name,
        filename: `seed_macro_${macroId.replace(/-/g, "").substring(0, 16)}`,
        description: m.description,
        language: m.language,
        code: m.code,
        sortOrder: m.sortOrder ?? null,
        createdBy: user.id,
      })
      .returning();
    createdMacros.push(macro);
  }

  console.log(`  Created ${createdMacros.length} macros`);

  // 4. Link protocols ↔ macros (diverse cross-links)
  const p = createdProtocols;
  const m = createdMacros;
  const pmLinks = [
    // Chlorophyll Fluorescence → Phi2 Quantum Yield, Data Formatter, Outlier Detection
    { protocolId: p[0].id, macroId: m[0].id },
    { protocolId: p[0].id, macroId: m[5].id },
    { protocolId: p[0].id, macroId: m[3].id },
    // Leaf Thickness → SPAD Estimator, Statistical Summary
    { protocolId: p[1].id, macroId: m[1].id },
    { protocolId: p[1].id, macroId: m[8].id },
    // SPAD Chlorophyll Index → SPAD Estimator, NDVI Calculator, Outlier Detection
    { protocolId: p[2].id, macroId: m[1].id },
    { protocolId: p[2].id, macroId: m[4].id },
    { protocolId: p[2].id, macroId: m[3].id },
    // PAR → Data Formatter, Unit Converter
    { protocolId: p[3].id, macroId: m[5].id },
    { protocolId: p[3].id, macroId: m[6].id },
    // ECS → ECS Decay Analysis, Statistical Summary
    { protocolId: p[4].id, macroId: m[2].id },
    { protocolId: p[4].id, macroId: m[8].id },
    // Leaf Reflectance NDVI → NDVI Calculator, Data Formatter
    { protocolId: p[5].id, macroId: m[4].id },
    { protocolId: p[5].id, macroId: m[5].id },
    // Soil Moisture → Geolocation Tagger, Unit Converter
    { protocolId: p[6].id, macroId: m[7].id },
    { protocolId: p[6].id, macroId: m[6].id },
    // Ambient Light & Temp → Data Formatter, ANOVA Analysis
    { protocolId: p[7].id, macroId: m[5].id },
    { protocolId: p[7].id, macroId: m[9].id },
    // Soil EC & pH → Statistical Summary, Geolocation Tagger
    { protocolId: p[8].id, macroId: m[8].id },
    { protocolId: p[8].id, macroId: m[7].id },
    // Canopy Temperature → Outlier Detection, ANOVA Analysis
    { protocolId: p[9].id, macroId: m[3].id },
    { protocolId: p[9].id, macroId: m[9].id },
  ];

  await db.insert(protocolMacros).values(pmLinks);
  console.log(`  Created ${pmLinks.length} protocol-macro links`);

  // 5. Create experiments
  const experimentData = [
    {
      name: "[Seed] Field Trial 2025 — Corn Photosynthesis",
      description: "Active field trial measuring photosynthetic efficiency across corn varieties in central Iowa.",
      status: "active" as const,
      visibility: "public" as const,
    },
    {
      name: "[Seed] Soybean Drought Response Study",
      description: "Published study on soybean physiological response to water stress conditions under controlled irrigation.",
      status: "published" as const,
      visibility: "public" as const,
    },
    {
      name: "[Seed] Indoor Lighting Calibration",
      description: "Archived calibration experiment for indoor growth chamber light sensors and PAR meters.",
      status: "archived" as const,
      visibility: "private" as const,
    },
    {
      name: "[Seed] Winter Wheat Phenotyping",
      description: "Active high-throughput phenotyping study of winter wheat cultivars for cold tolerance traits.",
      status: "active" as const,
      visibility: "public" as const,
    },
    {
      name: "[Seed] Soil Health Monitoring — Midwest",
      description: "Long-running soil health monitoring across multiple sites in the US Midwest, tracking EC, pH, and moisture.",
      status: "active" as const,
      visibility: "public" as const,
    },
  ];

  const createdExperiments = [];
  for (const e of experimentData) {
    const [experiment] = await db
      .insert(experiments)
      .values({
        ...e,
        createdBy: user.id,
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();
    createdExperiments.push(experiment);

    await db.insert(experimentMembers).values({
      experimentId: experiment.id,
      userId: user.id,
      role: "admin",
    });
  }

  console.log(`  Created ${createdExperiments.length} experiments`);

  // 6. Create flows for 3 experiments
  const ex = createdExperiments;
  const flowGraphs = [
    {
      experimentId: ex[0].id,
      graph: {
        nodes: [
          {
            id: "n1", type: "question", name: "Select Plot", isStart: true,
            content: { kind: "multi_choice", text: "Which plot are you measuring?", options: ["A1", "A2", "B1", "B2", "C1", "C2"], required: true },
          },
          {
            id: "n2", type: "instruction", name: "Position Sensor", isStart: false,
            content: { text: "Clamp the sensor on the third fully expanded leaf from the top of the plant." },
          },
          {
            id: "n3", type: "question", name: "Leaf Condition", isStart: false,
            content: { kind: "yes_no", text: "Is the leaf visibly healthy (no spots, wilting, or discoloration)?", required: true },
          },
          {
            id: "n4", type: "question", name: "Notes", isStart: false,
            content: { kind: "open_ended", text: "Any additional observations about this plant?", required: false },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
          { id: "e3", source: "n3", target: "n4", label: null },
        ],
      },
    },
    {
      experimentId: ex[1].id,
      graph: {
        nodes: [
          {
            id: "n1", type: "question", name: "Treatment Group", isStart: true,
            content: { kind: "multi_choice", text: "What is the treatment group?", options: ["Control", "Mild Stress", "Severe Stress"], required: true },
          },
          {
            id: "n2", type: "question", name: "Wilting Score", isStart: false,
            content: { kind: "open_ended", text: "Rate the wilting score (1-5):", required: true },
          },
          {
            id: "n3", type: "instruction", name: "Take Measurement", isStart: false,
            content: { text: "Place sensor on the youngest fully expanded trifoliate leaf." },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
        ],
      },
    },
    {
      experimentId: ex[3].id,
      graph: {
        nodes: [
          {
            id: "n1", type: "question", name: "Cultivar ID", isStart: true,
            content: { kind: "open_ended", text: "Enter the cultivar identifier:", required: true },
          },
          {
            id: "n2", type: "question", name: "Growth Stage", isStart: false,
            content: { kind: "multi_choice", text: "Current growth stage?", options: ["Tillering", "Stem Extension", "Heading", "Grain Fill"], required: true },
          },
          {
            id: "n3", type: "instruction", name: "Measure Flag Leaf", isStart: false,
            content: { text: "Measure the flag leaf at mid-blade, avoiding the midrib." },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: null },
          { id: "e2", source: "n2", target: "n3", label: null },
        ],
      },
    },
  ];

  await db.insert(flows).values(flowGraphs);
  console.log(`  Created ${flowGraphs.length} flows`);

  console.log("Seed complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });
