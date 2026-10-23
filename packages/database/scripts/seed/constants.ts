/** What every seed module agrees the seed owns, so a clear-out finds exactly those rows. */

export const SEED_EMAIL = "seed@openjii.local";
export const NEWCOMER_EMAIL = "newcomer@openjii.local";
export const SEED_PREFIX = "[Seed]%";

// Fixed UUIDs so two seeded experiments line up with measurement data in
// dev/staging Databricks: the silver pipeline joins on experiment_id, so
// pointing the local row at a real id makes /tables and /data return the
// real measurements without any local-only data plumbing.
export const EXPERIMENT_ID_SOIL_HEALTH = "06c68043-c4da-41e6-889e-75e3bad6b6fb";
export const EXPERIMENT_ID_WINTER_WHEAT = "3e5309b8-d5f2-4f7a-b20a-8b5e1e73a9f1";
// Has a real QUESTIONS-typed column in the silver layer, useful for
// demoing per-answer grouping on the bar chart.
export const EXPERIMENT_ID_CORN_QUESTIONS = "e917055f-b786-4d7b-a9da-acad73c4dab4";
// The seed owns these rows whatever they were renamed to; a rename must not
// leave a row behind that the next seed collides with.
export const SEED_EXPERIMENT_IDS = [
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
export const CONTRIBUTOR_SEEDS = [
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

export const DEMO_ORGANIZATION_ID = "82e9a684-8c1c-4967-b940-09735bb4b7ed";
export const DEMO_EXPERIMENT_ID_MULTISPEQ = "94d8b584-2d27-46fa-aa6c-8908ce13d521";
export const DEMO_EXPERIMENT_ID_AMBIT = "559e2a57-e120-44d6-8326-b929a359159b";
export const DEMO_EXPERIMENT_ID_MINIPAR = "76a1e1bd-55f4-4667-9770-cdeda202cd6f";

export const DEMO_SEED_FIXTURES = [
  {
    family: "multispeq",
    label: "MultispeQ",
    experimentId: DEMO_EXPERIMENT_ID_MULTISPEQ,
    protocolId: "ee6182e8-3fcf-4577-9441-75a7c8502118",
    macroId: "d02c023d-2fab-449a-a2f4-2357221563be",
    workbookId: "5d6f6f3e-8cec-4e9d-82eb-d43bbcc82785",
    versionId: "13b3bda0-1eb6-4605-9e85-16ace60a3163",
    dashboardId: "ad8d2c2e-f425-454c-abfc-6b476aa2ee19",
    chartId: "889239f4-fad6-455f-89b6-b313657b493c",
  },
  {
    family: "ambit",
    label: "Ambit",
    experimentId: DEMO_EXPERIMENT_ID_AMBIT,
    protocolId: "db2f158b-393a-4a74-b8bc-ec2223c2077a",
    macroId: "3f130a87-f421-4bae-9653-1415773ccc59",
    workbookId: "959fa1f4-92bb-4c42-a384-0120b085217b",
    versionId: "456e07de-9c51-4ce0-bfff-da5a786d4a7d",
    dashboardId: "ea5bdbdb-b0da-479c-b413-55f24f1bc5d0",
    chartId: "f3d47fd9-12f2-4d9d-8fd5-b9d6ad243852",
  },
  {
    family: "minipar",
    label: "MiniPAR",
    experimentId: DEMO_EXPERIMENT_ID_MINIPAR,
    protocolId: "837e7b13-692b-4bcb-b974-29967f810149",
    macroId: "4228d1b4-7b31-424c-ac4e-1a54e18aadf9",
    workbookId: "f2d8f75c-2b6c-4629-80da-9e11f22c950f",
    versionId: "bde2859b-f3ce-4681-9ae9-a5900956ecc9",
    dashboardId: "6e7c67b7-8c31-4ec3-86a5-33653abe1b7a",
    chartId: "58a3f888-9589-448a-afe2-0636d9203af0",
  },
] as const;
