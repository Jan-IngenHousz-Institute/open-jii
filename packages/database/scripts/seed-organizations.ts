import { and, eq, inArray, like } from "drizzle-orm";

import { db } from "../src/database";
import { ensurePersonalOrganization, personalOrgSlug } from "../src/organizations";
import { upsertGrant } from "../src/resource-grants";
import type { GrantRole, ResourceType } from "../src/resource-grants";
import {
  experiments,
  iotDevices,
  macros,
  organizationInvitations,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  profiles,
  protocols,
  resourceGrants,
  teamMembers,
  teams,
  users,
  workbooks,
} from "../src/schema";

/**
 * Local-dev seed for the organization detail pages.
 *
 * Unlike `seed.ts`, which wipes and recreates its own world, this one is additive:
 * it only removes what a previous run of *this* script created — organizations
 * whose slug starts `seed-`, whatever those organizations own, and the persona
 * users at `@orgseed.local` — so it is safe to run against a database holding real
 * work. Re-running replaces the seeded slice and nothing else.
 *
 * Each organization puts the detail pages in a different state, and the target
 * account holds a different relationship to each, so every view is reachable by
 * navigating between organizations rather than by logging out. See ORGANIZATIONS
 * in main() for the matrix.
 *
 * Personas are loggable-in: sign-in is OTP and the local mailcatcher accepts any
 * address, so `@orgseed.local` mail lands at http://localhost:1080.
 */

/** Cleanup key: every organization this script creates carries it. */
const SEED_ORG_SLUG_PREFIX = "seed-";
/** Cleanup key for the persona users, kept distinct from `seed.ts`'s own users. */
const PERSONA_EMAIL_DOMAIN = "orgseed.local";

/**
 * The account the matrix is written around. Overridable so the same script can set
 * a different developer up; the account has to exist already — inventing one would
 * produce a user with no credentials and no profile, which is worse than failing.
 */
const TARGET_EMAIL = process.env.SEED_ORG_TARGET_EMAIL ?? "vlad@info.nl";

type PersonaKey =
  | "maya"
  | "tomas"
  | "lena"
  | "arjun"
  | "sofie"
  | "noah"
  | "ines"
  | "kwame"
  | "elif"
  | "pieter"
  | "hana"
  | "marco"
  | "ada"
  | "bo"
  | "mira"
  | "rex"
  | "otto";

const PERSONAS: { key: PersonaKey; firstName: string; lastName: string }[] = [
  { key: "maya", firstName: "Maya", lastName: "Rasmussen" },
  { key: "tomas", firstName: "Tomas", lastName: "Berg" },
  { key: "lena", firstName: "Lena", lastName: "Fischer" },
  { key: "arjun", firstName: "Arjun", lastName: "Patel" },
  { key: "sofie", firstName: "Sofie", lastName: "Janssen" },
  { key: "noah", firstName: "Noah", lastName: "Visser" },
  { key: "ines", firstName: "Ines", lastName: "Duarte" },
  { key: "kwame", firstName: "Kwame", lastName: "Mensah" },
  { key: "elif", firstName: "Elif", lastName: "Yilmaz" },
  { key: "pieter", firstName: "Pieter", lastName: "de Vries" },
  { key: "hana", firstName: "Hana", lastName: "Kobayashi" },
  { key: "marco", firstName: "Marco", lastName: "Rossi" },
  // Named after what they demonstrate on the collaborators surface (org 8), so the
  // row a name lands on is readable without cross-referencing the roster.
  { key: "ada", firstName: "Ada", lastName: "Admin" },
  { key: "bo", firstName: "Bo", lastName: "Staleadmin" },
  { key: "mira", firstName: "Mira", lastName: "Member" },
  { key: "rex", firstName: "Rex", lastName: "Raised" },
  { key: "otto", firstName: "Otto", lastName: "Outside" },
];

function personaEmail(key: PersonaKey): string {
  return `${key}@${PERSONA_EMAIL_DOMAIN}`;
}

type OrgRole = "owner" | "admin" | "member";

interface ResourcePlan {
  experiments?: {
    name: string;
    description: string;
    status: "active" | "stale" | "archived" | "published";
    visibility: "public" | "private";
  }[];
  protocols?: {
    name: string;
    description: string;
    family: "multispeq" | "ambyte";
    visibility: "public" | "private";
  }[];
  macros?: {
    name: string;
    description: string;
    language: "python" | "r" | "javascript";
    visibility: "public" | "private";
  }[];
  workbooks?: { name: string; description: string; visibility: "public" | "private" }[];
}

interface CreatedResources {
  experiments: { id: string; name: string }[];
  protocols: { id: string; name: string }[];
  macros: { id: string; name: string }[];
  workbooks: { id: string; name: string }[];
}

/**
 * Remove the previous run's world.
 *
 * Order is forced by the schema: `resource_grants` is polymorphic on both sides and
 * has no FK cascade at all, and `iot_devices.organization_id` is RESTRICT because a
 * device owns a live AWS Thing. Everything else — members, teams, invitations, join
 * requests, and the four owned resource types — cascades off the organization.
 */
async function clearSeedOrganizationData() {
  const seededOrgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(like(organizations.slug, `${SEED_ORG_SLUG_PREFIX}%`));
  const orgIds = seededOrgs.map((o) => o.id);

  const personas = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%@${PERSONA_EMAIL_DOMAIN}`));
  const personaIds = personas.map((u) => u.id);

  if (orgIds.length > 0) {
    // Grants *on* the seeded resources. Read before the organizations go, since the
    // cascade takes the rows these ids come from with it.
    const owned: [ResourceType, { id: string }[]][] = [
      [
        "experiment",
        await db
          .select({ id: experiments.id })
          .from(experiments)
          .where(inArray(experiments.organizationId, orgIds)),
      ],
      [
        "protocol",
        await db
          .select({ id: protocols.id })
          .from(protocols)
          .where(inArray(protocols.organizationId, orgIds)),
      ],
      [
        "macro",
        await db
          .select({ id: macros.id })
          .from(macros)
          .where(inArray(macros.organizationId, orgIds)),
      ],
      [
        "workbook",
        await db
          .select({ id: workbooks.id })
          .from(workbooks)
          .where(inArray(workbooks.organizationId, orgIds)),
      ],
      [
        "device",
        await db
          .select({ id: iotDevices.id })
          .from(iotDevices)
          .where(inArray(iotDevices.organizationId, orgIds)),
      ],
    ];
    for (const [resourceType, rows] of owned) {
      if (rows.length === 0) continue;
      await db.delete(resourceGrants).where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          inArray(
            resourceGrants.resourceId,
            rows.map((r) => r.id),
          ),
        ),
      );
    }

    // Grants *to* the seeded teams and organizations — the other side of the same
    // missing cascade: a team grant survives its team otherwise.
    const seededTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.organizationId, orgIds));
    if (seededTeams.length > 0) {
      await db.delete(resourceGrants).where(
        and(
          eq(resourceGrants.granteeType, "team"),
          inArray(
            resourceGrants.granteeId,
            seededTeams.map((t) => t.id),
          ),
        ),
      );
    }
    await db
      .delete(resourceGrants)
      .where(
        and(
          eq(resourceGrants.granteeType, "organization"),
          inArray(resourceGrants.granteeId, orgIds),
        ),
      );

    // RESTRICT, so devices go before their organization.
    await db.delete(iotDevices).where(inArray(iotDevices.organizationId, orgIds));

    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }

  if (personaIds.length > 0) {
    // Personas exist only because of this script, so every grant they hold is ours.
    await db
      .delete(resourceGrants)
      .where(
        and(eq(resourceGrants.granteeType, "user"), inArray(resourceGrants.granteeId, personaIds)),
      );
    // Personal organizations auto-provisioned on first sign-in.
    await db
      .delete(organizations)
      .where(inArray(organizations.slug, personaIds.map(personalOrgSlug)));
    await db.delete(profiles).where(inArray(profiles.userId, personaIds));
    await db.delete(users).where(inArray(users.id, personaIds));
  }

  console.log(
    `  Removed ${orgIds.length} seeded organization(s) and ${personaIds.length} persona user(s)`,
  );
}

async function createOrganization(spec: {
  name: string;
  slug: string;
  visibility: "public" | "private";
  type?:
    | "research_institute"
    | "non_profit"
    | "private_company"
    | "government_agency"
    | "university";
  description?: string;
  website?: string;
  location?: string;
}): Promise<string> {
  const [org] = await db
    .insert(organizations)
    .values({
      name: spec.name,
      slug: spec.slug,
      visibility: spec.visibility,
      type: spec.type ?? null,
      description: spec.description ?? null,
      website: spec.website ?? null,
      location: spec.location ?? null,
    })
    .returning({ id: organizations.id });
  return org.id;
}

async function addMembers(organizationId: string, roster: { userId: string; role: OrgRole }[]) {
  await db
    .insert(organizationMembers)
    .values(roster.map(({ userId, role }) => ({ organizationId, userId, role })));
}

async function createTeam(
  organizationId: string,
  name: string,
  userIds: string[],
): Promise<string> {
  const [team] = await db
    .insert(teams)
    .values({ organizationId, name })
    .returning({ id: teams.id });
  if (userIds.length > 0) {
    await db.insert(teamMembers).values(userIds.map((userId) => ({ teamId: team.id, userId })));
  }
  return team.id;
}

/**
 * The organization's resources, plus the creator's admin grant on each — the same
 * pair the create-* use-cases write at runtime, and what the manage affordances read.
 *
 * "The same pair" includes when there is no grant: `seedCreatorControl` skips it for
 * a creator whose org role already carries full control, so seeding one anyway would
 * put an inert grant on every owner and make the collaborators surface open on a
 * "Grant has no effect" badge that runtime never produces.
 */
async function createResources(
  organizationId: string,
  createdBy: string,
  plan: ResourcePlan,
): Promise<CreatedResources> {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, createdBy),
      ),
    )
    .limit(1);
  const creatorNeedsGrant = membership?.role !== "owner" && membership?.role !== "admin";

  const created: CreatedResources = { experiments: [], protocols: [], macros: [], workbooks: [] };

  for (const e of plan.experiments ?? []) {
    const [row] = await db
      .insert(experiments)
      .values({ ...e, createdBy, organizationId })
      .returning({ id: experiments.id, name: experiments.name });
    created.experiments.push(row);
  }

  for (const p of plan.protocols ?? []) {
    const [row] = await db
      .insert(protocols)
      .values({
        ...p,
        code: [{ _protocol_set: [{ label: p.family === "ambyte" ? "Logger" : "Fluorescence" }] }],
        createdBy,
        organizationId,
      })
      .returning({ id: protocols.id, name: protocols.name });
    created.protocols.push(row);
  }

  for (const m of plan.macros ?? []) {
    // `macros.filename` is unique across the table, so it is derived from the row's
    // own id rather than from its (also unique, but human-chosen) name.
    const macroId = crypto.randomUUID();
    const [row] = await db
      .insert(macros)
      .values({
        ...m,
        id: macroId,
        filename: `orgseed_${macroId.replace(/-/g, "").substring(0, 16)}`,
        code: btoa(`# ${m.name}\n`),
        createdBy,
        organizationId,
      })
      .returning({ id: macros.id, name: macros.name });
    created.macros.push(row);
  }

  for (const w of plan.workbooks ?? []) {
    const [row] = await db
      .insert(workbooks)
      .values({ ...w, createdBy, organizationId })
      .returning({ id: workbooks.id, name: workbooks.name });
    created.workbooks.push(row);
  }

  if (creatorNeedsGrant) {
    for (const [resourceType, rows] of [
      ["experiment", created.experiments],
      ["protocol", created.protocols],
      ["macro", created.macros],
      ["workbook", created.workbooks],
    ] as [ResourceType, { id: string }[]][]) {
      for (const row of rows) {
        await upsertGrant(db, {
          resourceType,
          resourceId: row.id,
          granteeType: "user",
          granteeId: createdBy,
          role: "admin",
          createdBy,
        });
      }
    }
  }

  return created;
}

async function grantToUser(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  role: GrantRole,
  createdBy: string,
) {
  await upsertGrant(db, {
    resourceType,
    resourceId,
    granteeType: "user",
    granteeId: userId,
    role,
    createdBy,
  });
}

async function grantToOrganization(
  organizationId: string,
  resourceType: ResourceType,
  resourceId: string,
  role: GrantRole,
  createdBy: string,
) {
  await upsertGrant(db, {
    resourceType,
    resourceId,
    granteeType: "organization",
    granteeId: organizationId,
    role,
    createdBy,
  });
}

async function grantToTeam(
  teamId: string,
  resourceType: ResourceType,
  resourceId: string,
  role: GrantRole,
  createdBy: string,
) {
  await upsertGrant(db, {
    resourceType,
    resourceId,
    granteeType: "team",
    granteeId: teamId,
    role,
    createdBy,
  });
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const [target] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, TARGET_EMAIL))
    .limit(1);

  if (!target) {
    throw new Error(
      `No user with email ${TARGET_EMAIL} exists in this database. This script deliberately ` +
        `does not create the target account — sign in once as that user first, or point the ` +
        `script at an existing one with SEED_ORG_TARGET_EMAIL=someone@example.com.`,
    );
  }
  console.log(`Target account: ${TARGET_EMAIL} (${target.id})`);

  console.log("Clearing previous organization seed data...");
  await clearSeedOrganizationData();

  console.log("Seeding organizations...");

  // Persona users. Registered and verified so they read as real people on the
  // roster; sign-in is OTP, so the mailcatcher is the only credential they need.
  const personaRows = await db
    .insert(users)
    .values(
      PERSONAS.map((p) => ({
        name: `${p.firstName} ${p.lastName}`,
        email: personaEmail(p.key),
        emailVerified: true,
        registered: true,
      })),
    )
    .returning({ id: users.id, email: users.email });

  await db.insert(profiles).values(
    PERSONAS.map((p, i) => ({
      userId: personaRows[i].id,
      firstName: p.firstName,
      lastName: p.lastName,
      activated: true,
    })),
  );

  const person = Object.fromEntries(PERSONAS.map((p, i) => [p.key, personaRows[i].id])) as Record<
    PersonaKey,
    string
  >;

  // Personal organizations, exactly as first sign-in would provision them. They live
  // outside the organization surface, but their absence would make the personas
  // behave unlike every other account.
  for (const p of PERSONAS) {
    await ensurePersonalOrganization(db, {
      id: person[p.key],
      name: `${p.firstName} ${p.lastName}`,
    });
  }
  console.log(`  Created ${PERSONAS.length} persona users + personal organizations`);

  // ---------------------------------------------------------------------------
  // 1. Canopy Lab — the full house. Target is owner alongside a second owner, so
  //    demotion and leaving are both permitted.
  // ---------------------------------------------------------------------------
  const canopyId = await createOrganization({
    name: "Canopy Lab",
    slug: "seed-canopy-lab",
    visibility: "public",
    type: "research_institute",
    description:
      "A field and greenhouse group studying canopy-level photosynthesis in cereals. We run open phenotyping campaigns across the Gelderse Vallei and publish every protocol we use.",
    website: "https://canopylab.example.org",
    location: "Wageningen, Netherlands",
  });

  await addMembers(canopyId, [
    { userId: target.id, role: "owner" },
    { userId: person.maya, role: "owner" },
    { userId: person.tomas, role: "admin" },
    { userId: person.lena, role: "admin" },
    { userId: person.arjun, role: "member" },
    { userId: person.sofie, role: "member" },
    { userId: person.noah, role: "member" },
    { userId: person.ines, role: "member" },
  ]);

  const canopy = await createResources(canopyId, target.id, {
    experiments: [
      {
        name: "Canopy Light Interception 2026",
        description:
          "Season-long light interception measurements across twelve winter wheat plots, paired with hourly PAR logging.",
        status: "active",
        visibility: "public",
      },
      {
        name: "Vallei Drought Gradient",
        description:
          "Irrigation gradient trial on spring barley. Collection paused after the August heatwave cut the campaign short.",
        status: "stale",
        visibility: "public",
      },
      {
        name: "Greenhouse Chamber Calibration 2024",
        description:
          "Cross-calibration of the four growth chambers against a reference MultispeQ. Closed out and kept for reference.",
        status: "archived",
        visibility: "private",
      },
      {
        name: "Cereal Photosynthesis Atlas",
        description:
          "Published dataset of Phi2 and NPQ across 40 cereal accessions, released alongside the 2025 paper.",
        status: "published",
        visibility: "public",
      },
    ],
    protocols: [
      {
        name: "Canopy Phi2 Sweep",
        description:
          "Nine-point Phi2 sweep down the canopy profile, from flag leaf to the lowest green leaf.",
        family: "multispeq",
        visibility: "public",
      },
      {
        name: "Vallei Soil Logger",
        description:
          "Half-hourly soil moisture, EC and temperature logging at three depths through an Ambyte gateway.",
        family: "ambyte",
        visibility: "public",
      },
    ],
    macros: [
      {
        name: "Canopy Profile Fit",
        description: "Fits an exponential light-extinction curve to a canopy profile sweep.",
        language: "python",
        visibility: "public",
      },
      {
        name: "Plot Yield Regression",
        description: "Mixed-effects regression of plot yield on cumulative intercepted radiation.",
        language: "r",
        visibility: "private",
      },
      {
        name: "Field Tablet Formatter",
        description: "Normalises tablet-collected field notes into the campaign's record schema.",
        language: "javascript",
        visibility: "public",
      },
    ],
    workbooks: [
      {
        name: "Season 2026 Field Report",
        description: "Running analysis notebook for the 2026 interception campaign.",
        visibility: "public",
      },
      {
        name: "Chamber QC Scratchpad",
        description: "Internal quality-control checks on chamber sensor drift.",
        visibility: "private",
      },
    ],
  });

  const canopyTeams = {
    field: await createTeam(canopyId, "Field Operations", [
      person.tomas,
      person.arjun,
      person.sofie,
    ]),
    data: await createTeam(canopyId, "Data Platform", [person.lena, person.noah, target.id]),
    calibration: await createTeam(canopyId, "Sensor Calibration", [
      person.maya,
      person.ines,
      person.arjun,
    ]),
  };

  // Two devices, so the organization cannot be deleted while they exist. The second
  // is deliberately unnamed: `name` is the one nullable identifier on a device —
  // `thing_name` and `serial_number` are what a device is actually keyed by — so a
  // surface that names a device has to survive having nothing to print.
  const canopyDevices = await db
    .insert(iotDevices)
    .values([
      {
        thingName: "orgseed-canopy-multispeq-01",
        thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/orgseed-canopy-multispeq-01",
        serialNumber: "ORGSEED-CANOPY-0001",
        name: "Canopy MultispeQ 01",
        deviceType: "multispeq" as const,
        status: "active" as const,
        organizationId: canopyId,
        createdBy: target.id,
      },
      {
        thingName: "orgseed-canopy-ambyte-01",
        thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/orgseed-canopy-ambyte-01",
        serialNumber: "ORGSEED-CANOPY-0002",
        name: null,
        deviceType: "ambyte" as const,
        status: "active" as const,
        organizationId: canopyId,
        createdBy: target.id,
      },
    ])
    .returning({ id: iotDevices.id });

  // What each team can reach. Devices are in here deliberately: the team-reach
  // surface sweeps every staffed type, not just the four with a showcase — and one
  // of the two granted here has no name, which is the branch that surface has to
  // handle rather than the one it will be written against.
  await grantToTeam(canopyTeams.field, "experiment", canopy.experiments[0].id, "viewer", target.id);
  await grantToTeam(canopyTeams.field, "experiment", canopy.experiments[1].id, "viewer", target.id);
  await grantToTeam(canopyTeams.field, "device", canopyDevices[0].id, "viewer", target.id);
  await grantToTeam(canopyTeams.data, "workbook", canopy.workbooks[0].id, "admin", target.id);
  await grantToTeam(canopyTeams.data, "macro", canopy.macros[0].id, "viewer", target.id);
  await grantToTeam(canopyTeams.data, "experiment", canopy.experiments[3].id, "admin", target.id);
  await grantToTeam(
    canopyTeams.calibration,
    "protocol",
    canopy.protocols[0].id,
    "viewer",
    target.id,
  );
  await grantToTeam(canopyTeams.calibration, "device", canopyDevices[1].id, "admin", target.id);

  // Two live invitations, one per role that can be handed out below owner.
  await db.insert(organizationInvitations).values([
    {
      organizationId: canopyId,
      email: `rosa.lindqvist@${PERSONA_EMAIL_DOMAIN}`,
      role: "member",
      status: "pending",
      inviterId: target.id,
      expiresAt: daysFromNow(14),
    },
    {
      organizationId: canopyId,
      email: `daniel.okafor@${PERSONA_EMAIL_DOMAIN}`,
      role: "admin",
      status: "pending",
      inviterId: target.id,
      expiresAt: daysFromNow(6),
    },
  ]);

  // All four join-request statuses: two waiting in the queue, three in the history.
  // The approved requester is on the roster, which is what approval means.
  await db.insert(organizationJoinRequests).values([
    {
      organizationId: canopyId,
      userId: person.elif,
      message: "I run the barley phenotyping line in Nijmegen and would like to share protocols.",
      status: "pending",
    },
    {
      organizationId: canopyId,
      userId: person.pieter,
      message: "MSc student joining the Vallei campaign in March.",
      status: "pending",
    },
    {
      organizationId: canopyId,
      userId: person.ines,
      message: "Taking over sensor calibration from Maya.",
      status: "approved",
      decidedBy: target.id,
      decidedAt: daysFromNow(-21),
    },
    {
      organizationId: canopyId,
      userId: person.hana,
      message: "Interested in the chamber calibration data for a review paper.",
      status: "rejected",
      decidedBy: person.maya,
      decidedAt: daysFromNow(-9),
    },
    {
      organizationId: canopyId,
      userId: person.marco,
      message: "Asking on behalf of the Bologna group.",
      status: "cancelled",
      decidedBy: person.marco,
      decidedAt: daysFromNow(-4),
    },
  ]);
  console.log("  seed-canopy-lab — owner, full house");

  // ---------------------------------------------------------------------------
  // 2. Delta Phenotyping — target is admin under someone else's ownership.
  // ---------------------------------------------------------------------------
  const deltaId = await createOrganization({
    name: "Delta Phenotyping Centre",
    slug: "seed-delta-phenotyping",
    visibility: "public",
    type: "university",
    description:
      "University imaging facility for high-throughput plant phenotyping, open to external research groups on a shared-cost basis.",
    website: "https://delta-phenotyping.example.edu",
    location: "Delft, Netherlands",
  });

  await addMembers(deltaId, [
    { userId: person.maya, role: "owner" },
    { userId: target.id, role: "admin" },
    { userId: person.tomas, role: "member" },
    { userId: person.lena, role: "member" },
    { userId: person.kwame, role: "member" },
  ]);

  const delta = await createResources(deltaId, person.maya, {
    experiments: [
      {
        name: "Hyperspectral Cabinet Trial",
        description:
          "Weekly hyperspectral imaging of 96 Arabidopsis lines under two nitrogen regimes.",
        status: "active",
        visibility: "public",
      },
      {
        name: "Root Imaging Pilot",
        description: "Pilot run of the rhizotron imaging rig before the main campaign.",
        status: "published",
        visibility: "public",
      },
      {
        name: "Cabinet Sensor Drift 2025",
        description: "Long-term drift tracking for the cabinet's reference sensors.",
        status: "stale",
        visibility: "private",
      },
    ],
    protocols: [
      {
        name: "Cabinet Imaging Cycle",
        description:
          "Standard imaging cycle for the phenotyping cabinet, including dark adaptation.",
        family: "multispeq",
        visibility: "public",
      },
    ],
    macros: [
      {
        name: "Hyperspectral Band Reducer",
        description: "Reduces raw hyperspectral cubes to the twelve indices the facility reports.",
        language: "python",
        visibility: "public",
      },
    ],
    workbooks: [
      {
        name: "Facility Throughput Review",
        description: "Quarterly review of cabinet utilisation and turnaround times.",
        visibility: "public",
      },
    ],
  });

  const deltaTeams = {
    imaging: await createTeam(deltaId, "Imaging", [person.maya, person.kwame]),
    analysis: await createTeam(deltaId, "Analysis", [target.id, person.lena, person.tomas]),
  };
  await grantToTeam(deltaTeams.imaging, "protocol", delta.protocols[0].id, "admin", person.maya);
  await grantToTeam(
    deltaTeams.analysis,
    "experiment",
    delta.experiments[0].id,
    "viewer",
    person.maya,
  );
  await grantToTeam(deltaTeams.analysis, "macro", delta.macros[0].id, "viewer", person.maya);
  console.log("  seed-delta-phenotyping — admin under another owner");

  // ---------------------------------------------------------------------------
  // 3. Rhine Sensors — target is a plain member of a private organization.
  // ---------------------------------------------------------------------------
  const rhineId = await createOrganization({
    name: "Rhine Sensors",
    slug: "seed-rhine-sensors",
    visibility: "private",
    type: "private_company",
    description:
      "Instrumentation company building low-power field loggers. This workspace holds our firmware validation trials.",
    website: "https://rhinesensors.example.com",
    location: "Arnhem, Netherlands",
  });

  await addMembers(rhineId, [
    { userId: person.tomas, role: "owner" },
    { userId: person.lena, role: "admin" },
    { userId: target.id, role: "member" },
    { userId: person.noah, role: "member" },
  ]);

  const rhine = await createResources(rhineId, person.tomas, {
    experiments: [
      {
        name: "Logger Firmware 4.2 Validation",
        description:
          "Side-by-side validation of firmware 4.2 against the 3.9 baseline in the field.",
        status: "active",
        visibility: "private",
      },
      {
        name: "Cold Chamber Endurance Run",
        description: "Six-week endurance run at -15 °C to characterise battery behaviour.",
        status: "archived",
        visibility: "private",
      },
    ],
    protocols: [
      {
        name: "Endurance Logging Cycle",
        description: "Fifteen-minute logging cycle used for all endurance testing.",
        family: "ambyte",
        visibility: "private",
      },
    ],
    workbooks: [
      {
        name: "Firmware 4.2 Regression Notes",
        description: "Regression analysis across the validation deployments.",
        visibility: "private",
      },
    ],
  });

  const rhineTeams = {
    firmware: await createTeam(rhineId, "Firmware", [person.tomas, person.noah]),
    deployments: await createTeam(rhineId, "Deployments", [person.lena, target.id]),
  };
  await grantToTeam(
    rhineTeams.firmware,
    "experiment",
    rhine.experiments[0].id,
    "admin",
    person.tomas,
  );
  await grantToTeam(
    rhineTeams.deployments,
    "protocol",
    rhine.protocols[0].id,
    "viewer",
    person.tomas,
  );
  console.log("  seed-rhine-sensors — plain member, private");

  // ---------------------------------------------------------------------------
  // 4. Utrecht Plant Collective — public, target is an outsider. The private
  //    resources here are the ones that must *not* surface to them.
  // ---------------------------------------------------------------------------
  const utrechtId = await createOrganization({
    name: "Utrecht Plant Collective",
    slug: "seed-utrecht-plants",
    visibility: "public",
    type: "non_profit",
    description:
      "A volunteer network running citizen-science plant health measurements across urban green space in Utrecht.",
    website: "https://utrechtplants.example.org",
    location: "Utrecht, Netherlands",
  });

  await addMembers(utrechtId, [
    { userId: person.sofie, role: "owner" },
    { userId: person.kwame, role: "admin" },
    { userId: person.pieter, role: "member" },
  ]);

  await createResources(utrechtId, person.sofie, {
    experiments: [
      {
        name: "Urban Tree Stress Survey",
        description:
          "Citizen-collected chlorophyll fluorescence from street trees across the city.",
        status: "active",
        visibility: "public",
      },
      {
        name: "Park Meadow Restoration",
        description: "Three-year monitoring of restored meadow plots in Amelisweerd.",
        status: "published",
        visibility: "public",
      },
      {
        name: "Volunteer Training Runs",
        description: "Practice measurements from training sessions, kept out of the public record.",
        status: "stale",
        visibility: "private",
      },
    ],
    protocols: [
      {
        name: "Street Tree Quick Scan",
        description: "Two-minute scan volunteers run on a single street tree.",
        family: "multispeq",
        visibility: "public",
      },
    ],
    macros: [
      {
        name: "Volunteer Data Triage",
        description: "Flags implausible volunteer submissions before they reach the public set.",
        language: "javascript",
        visibility: "private",
      },
    ],
    workbooks: [
      {
        name: "City Health Dashboard",
        description: "Public-facing summary of the urban tree survey.",
        visibility: "public",
      },
    ],
  });
  console.log("  seed-utrecht-plants — outsider, mixed visibility");

  // ---------------------------------------------------------------------------
  // 5. Groningen Phenomics — outsider with a request already in flight.
  // ---------------------------------------------------------------------------
  const groningenId = await createOrganization({
    name: "Groningen Phenomics",
    slug: "seed-groningen-phenomics",
    visibility: "public",
    type: "government_agency",
    description:
      "National monitoring programme for crop phenotyping on reclaimed soils, run out of the northern research station.",
    website: "https://groningen-phenomics.example.gov",
    location: "Groningen, Netherlands",
  });

  await addMembers(groningenId, [
    { userId: person.noah, role: "owner" },
    { userId: person.kwame, role: "admin" },
    { userId: person.hana, role: "member" },
  ]);

  await createResources(groningenId, person.noah, {
    experiments: [
      {
        name: "Reclaimed Soil Baseline",
        description: "Baseline photosynthesis measurements across four reclaimed polder sites.",
        status: "active",
        visibility: "public",
      },
      {
        name: "Salinity Tolerance Screen",
        description: "Screening potato accessions for tolerance to rising soil salinity.",
        status: "published",
        visibility: "public",
      },
    ],
    protocols: [
      {
        name: "Polder Site Survey",
        description: "Standard survey protocol for the polder monitoring sites.",
        family: "multispeq",
        visibility: "public",
      },
    ],
  });

  await db.insert(organizationJoinRequests).values({
    organizationId: groningenId,
    userId: target.id,
    message: "Would like to compare our Vallei baseline against the polder sites.",
    status: "pending",
  });
  console.log("  seed-groningen-phenomics — outsider with a pending request");

  // ---------------------------------------------------------------------------
  // 6. Zeeland Field Station — private and no membership: has to read as
  //    non-existent to the target account, not as refused.
  // ---------------------------------------------------------------------------
  const zeelandId = await createOrganization({
    name: "Zeeland Field Station",
    slug: "seed-zeeland-field",
    visibility: "private",
  });

  await addMembers(zeelandId, [
    { userId: person.ines, role: "owner" },
    { userId: person.marco, role: "member" },
  ]);

  await createResources(zeelandId, person.ines, {
    experiments: [
      {
        name: "Saltwater Intrusion Plots",
        description: "Monitoring plots along the Oosterschelde for saltwater intrusion effects.",
        status: "active",
        visibility: "private",
      },
    ],
  });
  console.log("  seed-zeeland-field — invisible to the target account");

  // ---------------------------------------------------------------------------
  // 7. Solo Lab — sole owner and deliberately bare: every empty state at once,
  //    deletion permitted because nothing is owned, and the last-owner guards live.
  // ---------------------------------------------------------------------------
  const soloId = await createOrganization({
    name: "Solo Lab",
    slug: "seed-solo-lab",
    visibility: "private",
  });
  await addMembers(soloId, [{ userId: target.id, role: "owner" }]);
  console.log("  seed-solo-lab — sole owner, empty");

  // ---------------------------------------------------------------------------
  // 8. Access Showcase Lab — one experiment carrying every way access can arise, so
  //    a single collaborators tab shows all of them side by side. Two admins and two
  //    members, one of each holding a grant: the ones without are counted in their
  //    summary row, the ones with are broken out onto rows of their own. Plus an
  //    outsider, a team and another organization.
  // ---------------------------------------------------------------------------
  const showcaseId = await createOrganization({
    name: "Access Showcase Lab",
    slug: "seed-access-showcase",
    visibility: "private",
    type: "research_institute",
    description:
      "Every shape the collaborators surface can take, on one experiment. Seeded for walking through how access is derived.",
    location: "Wageningen, Netherlands",
  });

  await addMembers(showcaseId, [
    { userId: target.id, role: "owner" },
    { userId: person.ada, role: "admin" },
    { userId: person.bo, role: "admin" },
    { userId: person.mira, role: "member" },
    { userId: person.rex, role: "member" },
  ]);

  const showcase = await createResources(showcaseId, target.id, {
    experiments: [
      {
        name: "Access Showcase Experiment",
        description:
          "The flagship of the showcase organization: one experiment whose collaborators tab carries an owner, an admins summary, a members summary, a raising grant, an inert grant, an outside collaborator, a team and an organization.",
        status: "active",
        visibility: "private",
      },
    ],
  });
  const showcaseExperiment = showcase.experiments[0];

  const showcaseTeam = await createTeam(showcaseId, "Imaging Crew", [person.mira, person.ada]);

  // Bo administers the organization already, so this grant confers nothing — it is
  // the redundant one the surface has to label rather than offer a tier for, and it
  // is what takes Bo out of the admins count and onto a row of their own.
  await grantToUser(person.bo, "experiment", showcaseExperiment.id, "viewer", target.id);
  // Rex is a read-only member, so this one genuinely raises them.
  await grantToUser(person.rex, "experiment", showcaseExperiment.id, "admin", target.id);
  // Otto belongs to no organization here, which is what the outside badge means.
  await grantToUser(person.otto, "experiment", showcaseExperiment.id, "admin", target.id);
  await grantToTeam(showcaseTeam, "experiment", showcaseExperiment.id, "viewer", target.id);
  // An organization other than the owning one — also outside access, held by a group.
  await grantToOrganization(canopyId, "experiment", showcaseExperiment.id, "viewer", target.id);

  console.log(
    `  seed-access-showcase — every collaborator row at once on ` +
      `/platform/experiments/${showcaseExperiment.id}/collaborators`,
  );

  console.log("Organization seed complete!");
}

main()
  .catch((err) => {
    console.error("Organization seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });
