import { and, eq, inArray, like, or } from "drizzle-orm";

import { zCreateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { db } from "../src/database";
import { ensurePersonalOrganization, personalOrgSlug } from "../src/organizations";
import { upsertGrant } from "../src/resource-grants";
import {
  users,
  profiles,
  protocols,
  macros,
  protocolMacros,
  experiments,
  experimentMembers,
  experimentDevices,
  flows,
  calibrationDefinitions,
  calibrationRuns,
  deviceCalibrations,
  deviceGroupMembers,
  deviceGroups,
  iotDevices,
  organizations,
  resourceGrants,
  workbooks,
  workbookVersions,
} from "../src/schema";

const SEED_EMAIL = "seed@openjii.local";
const SEED_PREFIX = "[Seed]%";

// Fixed UUIDs so two seeded experiments line up with measurement data in
// dev/staging Databricks: the silver pipeline joins on experiment_id, so
// pointing the local row at a real id makes /tables and /data return the
// real measurements without any local-only data plumbing.
const EXPERIMENT_ID_SOIL_HEALTH = "06c68043-c4da-41e6-889e-75e3bad6b6fb";
const EXPERIMENT_ID_WINTER_WHEAT = "3e5309b8-d5f2-4f7a-b20a-8b5e1e73a9f1";
// Has a real QUESTIONS-typed column in the silver layer, useful for
// demoing per-answer grouping on the bar chart.
const EXPERIMENT_ID_CORN_QUESTIONS = "e917055f-b786-4d7b-a9da-acad73c4dab4";
// The seed owns these rows whatever they were renamed to; a rename must not
// leave a row behind that the next seed collides with.
const SEED_EXPERIMENT_IDS = [
  EXPERIMENT_ID_SOIL_HEALTH,
  EXPERIMENT_ID_WINTER_WHEAT,
  EXPERIMENT_ID_CORN_QUESTIONS,
];

// Contributor UUIDs that appear inside the contributor STRUCT on those
// Databricks rows. Local user rows aren't strictly required for chart
// rendering — the silver pipeline bakes name+avatar into each row — but
// any code that looks up a user by id (member roster, profile fetch)
// expects them to exist. Names are placeholders; bars still label by
// whatever the silver pipeline embedded in the row.
const CONTRIBUTOR_SEEDS = [
  {
    id: "e2b4c44b-a848-4686-8b03-e42e7abfa1de",
    name: "Participant One",
    email: "participant1@openjii.local",
    firstName: "Participant",
    lastName: "One",
    experimentId: EXPERIMENT_ID_SOIL_HEALTH,
  },
  {
    id: "25ea2f58-11aa-4b11-947d-5178ed2ecb76",
    name: "Participant Two",
    email: "participant2@openjii.local",
    firstName: "Participant",
    lastName: "Two",
    experimentId: EXPERIMENT_ID_SOIL_HEALTH,
  },
  {
    id: "96119c40-251f-439e-80ad-273234b22795",
    name: "Participant Three",
    email: "participant3@openjii.local",
    firstName: "Participant",
    lastName: "Three",
    experimentId: EXPERIMENT_ID_WINTER_WHEAT,
  },
  {
    id: "1cab43f8-252b-4044-a23b-a77a73c22fac",
    name: "Participant Four",
    email: "participant4@openjii.local",
    firstName: "Participant",
    lastName: "Four",
    experimentId: EXPERIMENT_ID_WINTER_WHEAT,
  },
] as const;

async function clearSeedData() {
  // User + profile (seed user)
  const seedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED_EMAIL));

  // Contributor users keyed by fixed UUIDs. We can't filter by email
  // pattern since the silver pipeline picks the contributor UUIDs, not us.
  const contributorIds = CONTRIBUTOR_SEEDS.map((c) => c.id);

  // Personal organizations provisioned for those seed users (Phase 1 org
  // provisioning). Everything created inside one goes with it, whatever it was named.
  const seedUserIds = [...seedUsers.map((u) => u.id), ...contributorIds];
  const seedOrganizations = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(inArray(organizations.slug, seedUserIds.map(personalOrgSlug)));
  const seedOrganizationIds = seedOrganizations.map((organization) => organization.id);

  // Find seed experiment IDs for join table cleanup
  const seedExperiments = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(
      or(
        like(experiments.name, SEED_PREFIX),
        inArray(experiments.id, SEED_EXPERIMENT_IDS),
        ...(seedOrganizationIds.length > 0
          ? [inArray(experiments.organizationId, seedOrganizationIds)]
          : []),
      ),
    );
  const seedExpIds = seedExperiments.map((e) => e.id);

  if (seedExpIds.length > 0) {
    // experiment_members is dormant, but its rows still have an FK to experiments
    // with no cascade, so any legacy rows must go before the experiments do.
    await db.delete(experimentMembers).where(inArray(experimentMembers.experimentId, seedExpIds));
    // Mirrored member grants are polymorphic (no FK), so no cascade either
    await db
      .delete(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          inArray(resourceGrants.resourceId, seedExpIds),
        ),
      );
    // Experiments cascade-delete: flows, experimentDevices
    await db.delete(experiments).where(inArray(experiments.id, seedExpIds));
  }

  // Calibration runs RESTRICT their definition, so runs go first; a run's
  // device_calibrations rows cascade with it.
  const seedDefinitions = await db
    .select({ id: calibrationDefinitions.id })
    .from(calibrationDefinitions)
    .where(like(calibrationDefinitions.name, SEED_PREFIX));
  const seedDefinitionIds = seedDefinitions.map((definition) => definition.id);
  if (seedDefinitionIds.length > 0) {
    await db
      .delete(calibrationRuns)
      .where(inArray(calibrationRuns.definitionId, seedDefinitionIds));
    await db
      .delete(calibrationDefinitions)
      .where(inArray(calibrationDefinitions.id, seedDefinitionIds));
  }

  // Groups cascade-delete their memberships.
  await db.delete(deviceGroups).where(like(deviceGroups.name, "[Seed]%"));

  // Devices before organizations: iot_devices references its org with RESTRICT.
  // Deleting a device cascade-removes its remaining experiment bindings.
  await db.delete(iotDevices).where(like(iotDevices.thingName, "seed-%"));

  // Workbooks cascade-delete their versions; experiments pointing at them are
  // already gone (or get workbook_version_id set null).
  await db.delete(workbooks).where(like(workbooks.name, SEED_PREFIX));

  // Protocols cascade-delete protocolMacros
  await db.delete(protocols).where(like(protocols.name, SEED_PREFIX));
  await db.delete(macros).where(like(macros.name, SEED_PREFIX));

  // Deleting an organization cascade-removes its organization_members.
  if (seedOrganizationIds.length > 0) {
    await db.delete(organizations).where(inArray(organizations.id, seedOrganizationIds));
  }

  if (seedUsers.length > 0) {
    await db.delete(profiles).where(eq(profiles.userId, seedUsers[0].id));
    await db.delete(users).where(eq(users.id, seedUsers[0].id));
  }
  await db.delete(profiles).where(inArray(profiles.userId, contributorIds));
  await db.delete(users).where(inArray(users.id, contributorIds));
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

  // Provision the seed user's personal organization (Phase 1 org provisioning).
  const personalOrganizationId = await ensurePersonalOrganization(db, user);

  console.log(`  Created user: ${user.id}`);

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
      code: btoa(
        "import numpy as np\n\ndef analyze(data):\n    fm_prime = data['Fm_prime']\n    fs = data['Fs']\n    return {'Phi2': (fm_prime - fs) / fm_prime}\n",
      ),
      sortOrder: 1,
    },
    {
      name: "[Seed] SPAD Estimator",
      language: "python",
      description:
        "Estimates SPAD chlorophyll values from dual-wavelength absorbance measurements.",
      code: btoa(
        "def estimate_spad(abs_650, abs_940):\n    ratio = abs_650 / abs_940\n    return ratio * 45.2 + 1.3\n",
      ),
      sortOrder: 2,
    },
    {
      name: "[Seed] ECS Decay Analysis",
      language: "python",
      description:
        "Fits exponential decay curves to electrochromic shift signals for pmf estimation.",
      code: btoa(
        "import numpy as np\nfrom scipy.optimize import curve_fit\n\ndef ecs_decay(t, a, tau):\n    return a * np.exp(-t / tau)\n",
      ),
      sortOrder: 3,
    },
    {
      name: "[Seed] Outlier Detection",
      language: "python",
      description: "Flags statistical outliers in measurement datasets using IQR method.",
      code: btoa(
        "import numpy as np\n\ndef flag_outliers(values):\n    q1, q3 = np.percentile(values, [25, 75])\n    iqr = q3 - q1\n    return (values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)\n",
      ),
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
      code: btoa(
        "function format(raw) {\n  return {\n    timestamp: Date.now(),\n    values: raw,\n    version: '1.0'\n  };\n}\n",
      ),
      sortOrder: 6,
    },
    {
      name: "[Seed] Unit Converter",
      language: "javascript",
      description: "Converts measurement units between metric and imperial for field data.",
      code: btoa(
        "const conversions = {\n  cm_to_in: v => v * 0.3937,\n  c_to_f: v => v * 9/5 + 32,\n  kpa_to_psi: v => v * 0.14504\n};\n",
      ),
      sortOrder: 7,
    },
    {
      name: "[Seed] Geolocation Tagger",
      language: "javascript",
      description: "Attaches GPS coordinates and location metadata to measurement records.",
      code: btoa(
        "function tagLocation(record, lat, lon) {\n  return { ...record, location: { lat, lon, tagged_at: new Date().toISOString() } };\n}\n",
      ),
      sortOrder: 8,
    },
    {
      name: "[Seed] Statistical Summary",
      language: "r",
      description:
        "Generates summary statistics (mean, median, sd, min, max) for all measurement columns.",
      code: btoa(
        "summary_stats <- function(df) {\n  sapply(df, function(x) c(mean=mean(x), median=median(x), sd=sd(x), min=min(x), max=max(x)))\n}\n",
      ),
      sortOrder: 9,
    },
    {
      name: "[Seed] ANOVA Analysis",
      language: "r",
      description: "Performs one-way ANOVA and Tukey HSD post-hoc tests across treatment groups.",
      code: btoa(
        "run_anova <- function(df, response, treatment) {\n  model <- aov(as.formula(paste(response, '~', treatment)), data=df)\n  list(anova=summary(model), tukey=TukeyHSD(model))\n}\n",
      ),
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
        organizationId: personalOrganizationId,
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

  // 5. Create experiments. Two experiments use fixed UUIDs so they line up
  // with dev/staging Databricks measurement data; the other three get
  // generated UUIDs as before.
  const experimentData: {
    id?: string;
    name: string;
    description: string;
    status: "active" | "published" | "archived";
    visibility: "public" | "private";
  }[] = [
    {
      id: EXPERIMENT_ID_CORN_QUESTIONS,
      name: "[Seed] Field Trial 2025 — Corn Photosynthesis",
      description:
        "Active field trial measuring photosynthetic efficiency across corn varieties in central Iowa.",
      status: "active",
      visibility: "public",
    },
    {
      name: "[Seed] Soybean Drought Response Study",
      description:
        "Published study on soybean physiological response to water stress conditions under controlled irrigation.",
      status: "published",
      visibility: "public",
    },
    {
      name: "[Seed] Indoor Lighting Calibration",
      description:
        "Archived calibration experiment for indoor growth chamber light sensors and PAR meters.",
      status: "archived",
      visibility: "private",
    },
    {
      id: EXPERIMENT_ID_WINTER_WHEAT,
      name: "[Seed] Winter Wheat Phenotyping",
      description:
        "Active high-throughput phenotyping study of winter wheat cultivars for cold tolerance traits.",
      status: "active",
      visibility: "public",
    },
    {
      id: EXPERIMENT_ID_SOIL_HEALTH,
      name: "[Seed] Soil Health Monitoring — Midwest",
      description:
        "Long-running soil health monitoring across multiple sites in the US Midwest, tracking EC, pH, and moisture.",
      status: "active",
      visibility: "public",
    },
  ];

  const createdExperiments = [];
  for (const e of experimentData) {
    const { id, ...rest } = e;
    const [experiment] = await db
      .insert(experiments)
      .values({
        ...(id ? { id } : {}),
        ...rest,
        createdBy: user.id,
        organizationId: personalOrganizationId,
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();
    createdExperiments.push(experiment);

    // Access comes from grants alone: the seeded owner gets the admin tier, exactly
    // as create-experiment does at runtime, and that grant is what the staffing
    // queries (last-admin protection, the deletion blocker) read.
    await upsertGrant(db, {
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: user.id,
      role: "admin",
      createdBy: user.id,
    });
  }

  console.log(`  Created ${createdExperiments.length} experiments`);

  // 5b. Seed contributor users and link them to the Databricks-backed
  // experiments. The names/emails are placeholders; bars in the bar chart
  // still label by the name embedded in each row's contributor struct.
  await db.insert(users).values(
    CONTRIBUTOR_SEEDS.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      emailVerified: true,
      registered: true,
    })),
  );
  await db.insert(profiles).values(
    CONTRIBUTOR_SEEDS.map((c) => ({
      userId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      activated: true,
    })),
  );
  // Contributors hold the read-and-contribute tier: they can open their experiment
  // and add measurements to it, which is exactly what these seeds represent.
  for (const c of CONTRIBUTOR_SEEDS) {
    await upsertGrant(db, {
      resourceType: "experiment",
      resourceId: c.experimentId,
      granteeType: "user",
      granteeId: c.id,
      role: "viewer",
      createdBy: c.id,
    });
  }
  // Provision each contributor's personal organization (Phase 1 org provisioning).
  for (const c of CONTRIBUTOR_SEEDS) {
    await ensurePersonalOrganization(db, { id: c.id, name: c.name });
  }
  console.log(`  Created ${CONTRIBUTOR_SEEDS.length} contributor users + grants`);

  // 6. Create flows for 3 experiments
  const ex = createdExperiments;
  const flowGraphs = [
    {
      experimentId: ex[0].id,
      graph: {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Select Plot",
            isStart: true,
            content: {
              kind: "multi_choice",
              text: "Which plot are you measuring?",
              options: ["A1", "A2", "B1", "B2", "C1", "C2"],
              required: true,
            },
          },
          {
            id: "n2",
            type: "instruction",
            name: "Position Device",
            isStart: false,
            content: {
              text: "Clamp the device on the third fully expanded leaf from the top of the plant.",
            },
          },
          {
            id: "n3",
            type: "question",
            name: "Leaf Condition",
            isStart: false,
            content: {
              kind: "yes_no",
              text: "Is the leaf visibly healthy (no spots, wilting, or discoloration)?",
              required: true,
            },
          },
          {
            id: "n4",
            type: "question",
            name: "Notes",
            isStart: false,
            content: {
              kind: "open_ended",
              text: "Any additional observations about this plant?",
              required: false,
            },
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
            id: "n1",
            type: "question",
            name: "Treatment Group",
            isStart: true,
            content: {
              kind: "multi_choice",
              text: "What is the treatment group?",
              options: ["Control", "Mild Stress", "Severe Stress"],
              required: true,
            },
          },
          {
            id: "n2",
            type: "question",
            name: "Wilting Score",
            isStart: false,
            content: { kind: "open_ended", text: "Rate the wilting score (1-5):", required: true },
          },
          {
            id: "n3",
            type: "instruction",
            name: "Take Measurement",
            isStart: false,
            content: { text: "Place the device on the youngest fully expanded trifoliate leaf." },
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
            id: "n1",
            type: "question",
            name: "Cultivar ID",
            isStart: true,
            content: { kind: "open_ended", text: "Enter the cultivar identifier:", required: true },
          },
          {
            id: "n2",
            type: "question",
            name: "Growth Stage",
            isStart: false,
            content: {
              kind: "multi_choice",
              text: "Current growth stage?",
              options: ["Tillering", "Stem Extension", "Heading", "Grain Fill"],
              required: true,
            },
          },
          {
            id: "n3",
            type: "instruction",
            name: "Measure Flag Leaf",
            isStart: false,
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

  // 7. Workbooks with a published version, pinned to two active experiments so
  // device onboarding configs carry a real procedure. Soil Health stays
  // unpinned to exercise the workbook-less config path. Like the real publish
  // flow, each version snapshots its referenced protocol's code so the config
  // is executable without a lookup. Corn pairs with an ambyte protocol (its
  // bound device is the Ambyte gateway); wheat with a multispeq one.
  const cornQuestion = {
    id: crypto.randomUUID(),
    type: "question",
    name: "plot",
    question: {
      kind: "multi_choice",
      text: "Which plot is this device stationed at?",
      options: ["A1", "A2", "B1", "B2"],
      required: true,
    },
    isCollapsed: false,
    isAnswered: false,
  };

  const workbookSeeds = [
    {
      name: "[Seed] Corn Measurement Workbook",
      description: "Measurement procedure for the corn photosynthesis field trial.",
      experimentId: ex[0].id,
      intro: "## Corn field procedure\nLog soil moisture at each plot marker.",
      protocol: p[6],
      question: cornQuestion,
    },
    {
      name: "[Seed] Wheat Phenotyping Workbook",
      description: "Flag leaf measurement procedure for the winter wheat phenotyping study.",
      experimentId: ex[3].id,
      intro: "## Wheat procedure\nMeasure the flag leaf at mid-blade, avoiding the midrib.",
      protocol: p[2],
      question: null,
    },
  ];

  for (const wb of workbookSeeds) {
    const cells = [
      {
        id: crypto.randomUUID(),
        type: "markdown",
        content: wb.intro,
        isCollapsed: false,
      },
      ...(wb.question ? [wb.question] : []),
      {
        id: crypto.randomUUID(),
        type: "protocol",
        payload: { protocolId: wb.protocol.id, version: 1, name: wb.protocol.name },
        isCollapsed: false,
      },
    ];

    const [workbook] = await db
      .insert(workbooks)
      .values({
        name: wb.name,
        description: wb.description,
        cells,
        createdBy: user.id,
        organizationId: personalOrganizationId,
      })
      .returning();

    const [version] = await db
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells,
        metadata: {},
        entitySnapshots: {
          protocols: {
            [wb.protocol.id]: { code: wb.protocol.code, family: wb.protocol.family },
          },
          macros: {},
        },
        createdBy: user.id,
      })
      .returning();

    await db
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: version.id })
      .where(eq(experiments.id, wb.experimentId));
  }

  console.log(`  Created ${workbookSeeds.length} workbooks (pinned versions)`);

  // 8. IoT devices across families and statuses. Thing/cert identifiers are
  // fakes; nothing here talks to AWS, so credential flows (issue, rotate,
  // revoke) still need a real device or localstack.
  const certFor = (slug: string) => ({
    certificateId: `seed-cert-${slug}`,
    certificateArn: `arn:aws:iot:local:000000000000:cert/seed-cert-${slug}`,
  });

  const deviceSeeds: {
    slug: string;
    name: string;
    deviceType: "multispeq" | "ambyte" | "ambit" | "minipar" | "mobile";
    status: "pending" | "active" | "revoked";
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
      status: "pending",
    },
    {
      slug: "multispeq-01",
      name: "[Seed] MultispeQ Handheld 01",
      deviceType: "multispeq",
      status: "active",
    },
    { slug: "ambit-01", name: "[Seed] Ambit Logger 01", deviceType: "ambit", status: "active" },
    {
      slug: "minipar-01",
      name: "[Seed] MiniPAR Sensor 01",
      deviceType: "minipar",
      status: "active",
    },
    { slug: "retired-gw", name: "[Seed] Retired Gateway", deviceType: "ambyte", status: "revoked" },
  ];

  const createdDevices = await db
    .insert(iotDevices)
    .values(
      deviceSeeds.map((d, index) => ({
        thingName: `seed-${d.slug}`,
        thingArn: `arn:aws:iot:local:000000000000:thing/seed-${d.slug}`,
        serialNumber: `SEED-SN-${String(index + 1).padStart(4, "0")}`,
        name: d.name,
        deviceType: d.deviceType,
        status: d.status,
        ...(d.status === "pending" ? {} : certFor(d.slug)),
        organizationId: personalOrganizationId,
        createdBy: user.id,
      })),
    )
    .returning();

  console.log(`  Created ${createdDevices.length} IoT devices`);

  // 9. Bind devices to experiments. Ambyte 01 also serves the archived
  // experiment: it shows the archived badge in the device's list, is excluded
  // from re-issued configs, and stays detachable.
  const d = createdDevices;
  const bindings = [
    { experimentId: ex[0].id, deviceId: d[0].id },
    { experimentId: ex[4].id, deviceId: d[0].id },
    { experimentId: ex[2].id, deviceId: d[0].id },
    { experimentId: ex[3].id, deviceId: d[2].id },
    { experimentId: ex[4].id, deviceId: d[4].id },
    { experimentId: ex[0].id, deviceId: d[5].id },
  ];

  await db
    .insert(experimentDevices)
    .values(bindings.map((binding) => ({ ...binding, addedBy: user.id })));
  console.log(`  Created ${bindings.length} experiment-device bindings`);

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

  // 11. Calibration: the two MiniPAR bench procedures as definitions, plus the
  // result the manual one produced on a real sensor, approved and written, so
  // the run history, the active calibration and the write report each have a
  // real row behind them before any device is plugged in.
  const miniparParFitScript = (orderedByStimulus: boolean) => `import math

from qc import assess_linear_fit

# Map the sensor's uncalibrated PAR onto the reference, y = slope * x + intercept,
# the straight line the bench procedure fits with numpy.polyfit(x, y, 1).
points = inputs["par_sweep"]
fit = assess_linear_fit(
    points["par_raw"],
    points["par_ref"],
${orderedByStimulus ? '    points["stimulus"],\n' : ""}    slope_min=0.1,
    slope_max=10.0,
    intercept_min=-100.0,
    intercept_max=100.0,
)

# The thresholds are the platform's until the scientist supplies real ones: a
# failed gate travels with the block as advice and the reviewer decides.
fitted = math.isfinite(fit["slope"]) and math.isfinite(fit["intercept"])
if fitted:
    block = {
        "status": "computed",
        "coefficients": {"slope": fit["slope"], "intercept": fit["intercept"]},
        "quality": fit,
    }
else:
    block = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}
submit({"par": block})
`;

  const miniparOutputSchema = {
    blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
  };

  const miniparSpectralFitScript = `import math

from qc import assess_multilinear_fit

# The console prints the raw spectrum as "<model>,ch0,...,chN". The first ten channels
# feed a least-squares fit, y = sum(coefficient[i] * channel[i]) + intercept, which is
# what the bench procedure does before uploading the channel coefficients.
CHANNELS = 10


def channel_counts(line):
    parts = [part.strip() for part in str(line).split(",") if part.strip()]
    if parts and not parts[0][0].isdigit():
        parts = parts[1:]
    return [float(part) for part in parts[:CHANNELS]]


points = inputs["spec_sweep"]
fit = assess_multilinear_fit(
    [channel_counts(line) for line in points["spec"]],
    points["par_ref"],
    intercept_min=-100.0,
    intercept_max=100.0,
)

# The thresholds are the platform's until the scientist supplies real ones: a
# failed gate travels with the block as advice and the reviewer decides.
fitted = all(math.isfinite(value) for value in fit["coefficients"]) and math.isfinite(
    fit["intercept"]
)
if fitted:
    block = {
        "status": "computed",
        # The device applies the channel coefficients; the intercept stays on the run.
        "coefficients": {"channel_coefficients": fit["coefficients"]},
        "fit": {"intercept": fit["intercept"]},
        "quality": fit,
    }
else:
    block = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}
submit({"spec": block})
`;

  const miniparSpectralOutputSchema = {
    blocks: { spec: { channel_coefficients: { type: "number_array", length: 10 } } },
  };

  const ambitFactoryScript = `import json
import math

from qc import assess_origin_fit

# The PAR console answers its reading and its spectral channels together.
def par_reading(reply):
    return float(json.loads(str(reply))["par"])


par_points = inputs["par_sweep"]
par_fit = assess_origin_fit(
    [par_reading(reply) for reply in par_points["par"]],
    par_points["par_ref"],
    par_points["stimulus"],
    coefficient_min=0.05,
    coefficient_max=100.0,
)

# The actinic curve is fitted the other way round: the reference reads the light the
# LED made, and the coefficient turns that light back into the setting behind it.
led_points = inputs["led_sweep"]
led_fit = assess_origin_fit(
    led_points["emit_ref"],
    led_points["stimulus"],
    led_points["stimulus"],
    coefficient_min=0.01,
    coefficient_max=1.0,
)

CHANNEL_0_DARK_MAX = 400
channels = [int(value) for value in inputs["adpd_baseline"]["channels"][0]]
is_dark = channels[0] <= CHANNEL_0_DARK_MAX


def gain_block(fit, name):
    if math.isfinite(fit["coefficient"]):
        return {
            "status": "computed",
            "coefficients": {name: fit["coefficient"]},
            "quality": fit,
        }
    return {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}


# A baseline that never went dark is advice, not a refusal: the reviewer decides,
# the same way a failed fit gate travels with its block.
submit(
    {
        "par": gain_block(par_fit, "spec"),
        "led": gain_block(led_fit, "act"),
        "baseline": {
            "status": "computed",
            "coefficients": {"channels": channels},
            "quality": {
                "passed": is_dark,
                "reasons": [] if is_dark else ["the first channel is too bright for a dark baseline"],
                "channel_0": channels[0],
                "thresholds": {"channel_0_max": CHANNEL_0_DARK_MAX},
            },
        },
    }
)
`;

  const ambitOutputSchema = {
    blocks: {
      par: { spec: { type: "number", min: 0.05, max: 100 } },
      led: { act: { type: "number", min: 0.01, max: 1 } },
      baseline: { channels: { type: "integer_array", length: 6, min: 0, max: 16777215 } },
    },
  };

  // Which spectrometer channel sees each LED best, and where its usable range starts.
  const multispeqLedChannels = [
    { led: 1, channel: 3, from: 100 },
    { led: 2, channel: 9, from: 100 },
    { led: 3, channel: 7, from: 100 },
    { led: 4, channel: 1, from: 100 },
    { led: 5, channel: 5, from: 300 },
  ];

  const ledBrightnessSteps = (from: number) =>
    Array.from({ length: 10 }, (_, index) => Math.round(from + ((800 - from) * index) / 9));

  const multispeqLedScript = `import math

from qc import assess_linear_fit

# One straight line per LED: counts rise with the setting its driver is given.
blocks = {}
for led in [${multispeqLedChannels.map(({ led }) => led).join(", ")}]:
    points = inputs[f"led_{led}"]
    fit = assess_linear_fit(
        points["stimulus"],
        points["counts"],
        points["stimulus"],
        slope_min=0.0001,
        slope_max=1000.0,
        intercept_min=-100000.0,
        intercept_max=100000.0,
    )
    fitted = math.isfinite(fit["slope"]) and math.isfinite(fit["intercept"])
    if fitted:
        blocks[f"led{led}"] = {
            "status": "computed",
            "coefficients": {"slope": fit["slope"], "intercept": fit["intercept"]},
            "quality": fit,
        }
    else:
        blocks[f"led{led}"] = {
            "status": "rejected",
            "reason": "; ".join(fit["reasons"]),
            "quality": fit,
        }

submit(blocks)
`;

  const multispeqLedOutputSchema = {
    blocks: Object.fromEntries(
      multispeqLedChannels.map(({ led }) => [
        `led${led}`,
        { slope: { type: "number" }, intercept: { type: "number" } },
      ]),
    ),
  };

  const calibrationDefinitionSeeds = [
    {
      family: "minipar",
      name: "[Seed] MiniPAR PAR calibration, manual bench",
      description:
        "Three points against a reference PAR sensor: two light levels and darkness. The operator sets the light and types the reference reading; the fit maps uncalibrated PAR onto the reference.",
      captureProcedure: {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "operator",
            prompt:
              "Place the MiniPAR next to the reference PAR sensor so both see the same light.",
          },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              operator: "Set up {value}, then wait for both readings to settle before continuing.",
              values: ["a first light level", "a second light level", "darkness"],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
        // The bench procedure re-reads calibrated PAR beside the reference once the write is in.
        verify: [
          {
            kind: "read",
            series: "par_check",
            prompt: "Keep both sensors in the same light for the check reading.",
            read: [
              { instrument: "dut", command: "par", as: "par" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
      },
      script: miniparParFitScript(false),
      outputSchema: miniparOutputSchema,
    },
    {
      family: "minipar",
      name: "[Seed] MiniPAR PAR calibration, automated bench",
      description:
        "A DC supply steps the lamp through six currents while a MicroPython photodiode supplies the reference. The same fit as the manual bench, with the sweep ordered by lamp current.",
      captureProcedure: {
        instruments: [
          { role: "dut" },
          { role: "lamp", handshake: "KIPRIM" },
          { role: "par_ref", handshake: "raw REPL" },
        ],
        steps: [
          {
            kind: "operator",
            prompt: "Aim the lamp at the MiniPAR and the reference photodiode.",
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
          { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              instrument: "lamp",
              set: "current_a",
              values: [0.2, 0.4, 0.8, 1.0, 1.6, 0],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
        ],
        // The bench procedure checks one lamp current after the write, then rests the lamp.
        verify: [
          { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
          { kind: "settle", ms: 1000 },
          {
            kind: "read",
            series: "par_check",
            read: [
              { instrument: "dut", command: "par", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
        ],
      },
      script: miniparParFitScript(true),
      outputSchema: miniparOutputSchema,
    },
    {
      family: "minipar",
      name: "[Seed] MiniPAR spectral PAR calibration, manual bench",
      description:
        "Optical filters change the spectrum in front of the MiniPAR and a reference PAR sensor. A least-squares fit maps the ten raw spectral channels onto the reference; the ten channel coefficients are written to the device and the fitted intercept is kept on the run.",
      captureProcedure: {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "operator",
            prompt:
              "Place the MiniPAR next to the reference PAR sensor so both see the same light through the same filter.",
          },
          {
            kind: "sweep",
            series: "spec_sweep",
            stimulus: {
              operator:
                "Cover both sensors with {value}, then wait for the readings to settle before continuing.",
              values: [
                "no filter",
                "filter e002",
                "filter e003",
                "filter e004",
                "filter e007",
                "filter e008",
                "filter e009",
                "filter e010",
                "filter e013",
                "filter e015",
                "filter e017",
                "the dark cap",
              ],
            },
            settleMs: 1000,
            read: [
              // Basic counts, which is what the firmware multiplies its stored coefficients
              // by. Fitting the raw counts instead scales every later reading by the
              // gain and integration time the sweep happened to run at.
              { instrument: "dut", command: "spec", as: "spec" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
        // Three of the filters again, reading the spectral PAR the device now computes.
        verify: [
          {
            kind: "sweep",
            series: "spec_check",
            stimulus: {
              operator:
                "Cover both sensors with {value}, then wait for the readings to settle before continuing.",
              values: ["no filter", "filter e004", "the dark cap"],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "spec", as: "spec" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
      },
      script: miniparSpectralFitScript,
      outputSchema: miniparSpectralOutputSchema,
    },
    {
      family: "ambit",
      name: "[Seed] Ambit factory calibration",
      description:
        "The factory bench in one procedure: a lamp sweep against a PAR reference fits the sensor's PAR gain, an actinic sweep against a second reference fits its LED gain, and a covered sensor measures the dark baseline of its six detector channels.",
      captureProcedure: {
        instruments: [
          { role: "dut" },
          { role: "lamp", handshake: "KIPRIM" },
          { role: "par_ref", handshake: "Par_REF" },
          { role: "emit_ref", handshake: "Emit_LED" },
        ],
        steps: [
          {
            kind: "operator",
            prompt:
              "Aim the lamp at the sensor and the PAR reference, and place the emission reference over the sensor's own LED.",
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
          { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              instrument: "lamp",
              set: "current_a",
              values: [0.8, 2.4, 3.0, 4.0, 6.6, 0],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "get_par", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          {
            kind: "sweep",
            series: "led_sweep",
            stimulus: {
              instrument: "dut",
              set: "led_setting",
              values: [10, 20, 60, 90, 150, 250, 0],
            },
            settleMs: 400,
            read: [{ instrument: "emit_ref", command: "par", as: "emit_ref" }],
          },
          {
            kind: "operator",
            prompt: "Cover the sensor so no light reaches it, then type DARK to measure it.",
            confirm: "DARK",
          },
          {
            kind: "read",
            series: "adpd_baseline",
            // The measurement runs on the device and answers only when it is done.
            read: [{ instrument: "dut", command: "baseline,0", as: "channels", timeoutMs: 25000 }],
          },
        ],
        // The calibrated reading beside the reference at one lamp current, then the lamp off.
        verify: [
          { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
          { kind: "settle", ms: 1000 },
          {
            kind: "read",
            series: "par_check",
            read: [
              { instrument: "dut", command: "PAR", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
        ],
      },
      script: ambitFactoryScript,
      outputSchema: ambitOutputSchema,
    },
    {
      family: "multispeq",
      name: "[Seed] MultispeQ LED calibration, tool board",
      description:
        "Each of the first five LEDs is stepped through ten settings while a spectrometer board reads the channel that sees it best. One line per LED relates the setting to the light it produces.",
      captureProcedure: {
        instruments: [{ role: "dut" }, { role: "calitool", handshake: "CaliTool" }],
        steps: [
          {
            kind: "operator",
            prompt:
              "Seat the sensor on the tool board so its LEDs shine into the spectrometer window, and shield the pair from room light.",
          },
          // The board lights its own LED at power-up and only a zero clears it, and its
          // integration step survives a port close, so both are set rather than assumed.
          { kind: "set", instrument: "calitool", set: "led_ma", value: 0 },
          { kind: "set", instrument: "calitool", set: "gain", value: 1 },
          { kind: "set", instrument: "calitool", set: "atime", value: 200 },
          { kind: "set", instrument: "calitool", set: "astep", value: 200 },
          ...multispeqLedChannels.flatMap(({ led, channel, from }) => [
            {
              kind: "sweep",
              series: `led_${led}`,
              stimulus: {
                instrument: "dut",
                set: `led_${led}`,
                values: ledBrightnessSteps(from),
              },
              settleMs: 100,
              read: [{ instrument: "calitool", command: `channel_${channel}`, as: "counts" }],
            },
            // Dark again before the next LED, so one lit LED never colours another's line.
            { kind: "set", instrument: "dut", set: `led_${led}`, value: 0 },
          ]),
        ],
      },
      script: multispeqLedScript,
      outputSchema: multispeqLedOutputSchema,
    },
  ];

  // Parsed through the contract so a seeded definition is exactly what the API would accept.
  const createdDefinitions = await db
    .insert(calibrationDefinitions)
    .values(
      calibrationDefinitionSeeds.map((seed) => ({
        ...zCreateCalibrationDefinitionBody.parse(seed),
        organizationId: personalOrganizationId,
        createdBy: user.id,
      })),
    )
    .returning();
  console.log(`  Created ${createdDefinitions.length} calibration definitions`);

  // The manual bench's real outcome on a MiniPAR: firmware 1.03 answered
  // "MiniPAR,1.1,1.03", the fit came out at slope 0.96 and intercept -1.08,
  // and the device echoed both values back when they were written.
  const benchCoefficients = { slope: 0.96, intercept: -1.08 };
  const benchTime = new Date();
  const [benchRun] = await db
    .insert(calibrationRuns)
    .values({
      definitionId: createdDefinitions[0].id,
      deviceId: d[4].id,
      requestedBy: user.id,
      inputSource: "external_bench",
      status: "approved",
      blocks: { par: { status: "computed", coefficients: benchCoefficients } },
      preInfo: { helloReply: "MiniPAR,1.1,1.03", deviceName: "miniPAR" },
      firmwareVersion: "1.03",
      reviewedBy: user.id,
      reviewedAt: benchTime,
      finishedAt: benchTime,
    })
    .returning();

  await db.insert(deviceCalibrations).values({
    deviceId: d[4].id,
    runId: benchRun.id,
    blocks: { par: { coefficients: benchCoefficients } },
    approvedBy: user.id,
    writtenToDeviceAt: benchTime,
    writeResults: { par: { verified: true } },
  });
  console.log("  Created 1 approved calibration run and the MiniPAR's active calibration");

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
