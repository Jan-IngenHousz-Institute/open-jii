/** What every seed module agrees the seed owns, so a clear-out finds exactly those rows. */

export const SEED_EMAIL = "seed@openjii.local";
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
