import type { Page, Route } from "@playwright/test";
import postgres from "postgres";

import { assertSafeFixtureDatabase, databaseUrl, seedEmail } from "./helpers.js";

const experimentName = "[E2E] Dialog fit experiment";
const tableName = "raw_data";

function connect() {
  return postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
}

export async function cleanupDialogFitExperiment(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = connect();
  try {
    await sql.begin(async (transaction) => {
      const experiments = await transaction<{ id: string }[]>`
        select id from experiments where name = ${experimentName}
      `;
      const experimentIds = experiments.map(({ id }) => id);
      if (experimentIds.length === 0) return;
      await transaction`
        delete from resource_grants
        where resource_type = 'experiment'
          and resource_id in ${transaction(experimentIds)}
      `;
      await transaction`delete from experiments where id in ${transaction(experimentIds)}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** An active experiment the seed user administers, so every data dialog is enabled. */
export async function seedDialogFitExperiment(): Promise<string> {
  await cleanupDialogFitExperiment();
  const sql = connect();
  try {
    return await sql.begin(async (transaction) => {
      const seeds = await transaction<{ id: string; organization_id: string }[]>`
        select u.id, m.organization_id
        from users u
        join organization_members m on m.user_id = u.id
        where u.email = ${seedEmail}
        order by m.created_at
        limit 1
      `;
      const seed = seeds.at(0);
      if (!seed) throw new Error(`No user and organization found for ${seedEmail}`);
      const experiments = await transaction<{ id: string }[]>`
        insert into experiments (name, description, status, visibility, created_by, organization_id)
        values (
          ${experimentName}, 'Fixture for dialog fit E2E coverage', 'active', 'private',
          ${seed.id}, ${seed.organization_id}
        )
        returning id
      `;
      const experiment = experiments.at(0);
      if (!experiment) throw new Error("Failed to create the dialog-fit experiment");
      await transaction`
        insert into resource_grants (resource_type, resource_id, grantee_type, grantee_id, role, created_by)
        values ('experiment', ${experiment.id}, 'user', ${seed.id}, 'admin', ${seed.id})
      `;
      // The metadata dialog reads the flow for its match targets; flows cascade with the experiment.
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Select Plot",
            isStart: true,
            content: {
              kind: "multi_choice",
              text: "Which plot are you measuring?",
              options: ["A1", "A2"],
              required: true,
            },
          },
        ],
        edges: [],
      };
      await transaction`
        insert into flows (experiment_id, graph) values (${experiment.id}, ${transaction.json(graph)})
      `;
      return experiment.id;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export interface LakehouseData {
  /** Whether the experiment has a table, which is what renders the data table and its export. */
  withTable?: boolean;
  uploads?: number;
  metadata?: number;
  exports?: number;
}

const createdAt = "2026-09-25T09:09:24.000Z";

function uploadRecords(experimentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const failed = i % 3 === 2;
    return {
      uploadId: crypto.randomUUID(),
      experimentId,
      uploadTableId: crypto.randomUUID(),
      uploadTableName: `gas_exchange_${count - i}`,
      sourceKind: i % 2 === 0 ? "csv" : "parquet",
      status: failed ? "failed" : "completed",
      fileCount: failed ? 0 : 1,
      rowCount: failed ? 0 : 42,
      createdBy: crypto.randomUUID(),
      createdAt,
      completedAt: createdAt,
      errorMessage: failed ? "The file has no header row." : null,
    };
  });
}

function metadataRecords(experimentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    metadataId: crypto.randomUUID(),
    experimentId,
    metadata: {
      name: `Plot layout ${i + 1}`,
      columns: [
        { id: "plot", name: "plot", type: "string" },
        { id: "treatment", name: "treatment", type: "string" },
      ],
      rows: [{ plot: "A1", treatment: "control" }],
      identifierColumnId: "plot",
      experimentQuestionId: "",
    },
    createdBy: crypto.randomUUID(),
    createdAt,
    updatedAt: createdAt,
  }));
}

function exportRecords(experimentId: string, count: number) {
  return Array.from({ length: count }, () => ({
    exportId: crypto.randomUUID(),
    experimentId,
    tableName,
    format: "csv",
    status: "completed",
    filePath: null,
    rowCount: 42,
    fileSize: 2048,
    createdBy: crypto.randomUUID(),
    createdAt,
    completedAt: createdAt,
  }));
}

const columns = [
  { name: "id", type_name: "BIGINT", type_text: "bigint" },
  { name: "plot", type_name: "STRING", type_text: "string" },
];

/**
 * Answers every lakehouse-backed experiment endpoint in the browser, so no request reaches the
 * backend's Databricks client and each dialog gets a deterministic number of records.
 */
export async function mockLakehouse(
  page: Page,
  experimentId: string,
  data: LakehouseData,
): Promise<void> {
  const prefix = `/api/v1/experiments/${experimentId}`;
  const json = (route: Route, body: unknown) => route.fulfill({ json: body });

  await page.route(
    (url) =>
      url.pathname.startsWith(`${prefix}/tables`) ||
      url.pathname.startsWith(`${prefix}/data`) ||
      url.pathname.startsWith(`${prefix}/metadata`),
    async (route) => {
      const { pathname } = new URL(route.request().url());
      const path = pathname.slice(prefix.length);
      if (route.request().method() !== "GET") {
        return route.fulfill({ status: 503, json: { message: "Mocked lakehouse is read-only" } });
      }
      if (path === "/tables") {
        return json(
          route,
          data.withTable
            ? [
                {
                  identifier: tableName,
                  tableType: "static",
                  displayName: "Raw data",
                  totalRows: 2,
                  latestRowAt: createdAt,
                  schemaRevision: "1",
                },
              ]
            : [],
        );
      }
      if (path === "/metadata")
        return json(route, metadataRecords(experimentId, data.metadata ?? 0));
      if (path === "/data/uploads") {
        return json(route, { uploads: uploadRecords(experimentId, data.uploads ?? 0) });
      }
      if (path === "/data/exports") {
        return json(route, { exports: exportRecords(experimentId, data.exports ?? 0) });
      }
      if (path === "/data/columns") return json(route, { columns });
      if (path === "/data/distinct") return json(route, { values: [], truncated: false });
      if (path === "/data") {
        return json(route, [
          {
            name: tableName,
            catalog_name: "e2e",
            schema_name: "e2e",
            data: {
              columns,
              rows: [
                { id: "1", plot: "A1" },
                { id: "2", plot: "A2" },
              ],
              totalRows: 2,
              truncated: false,
            },
            page: 1,
            pageSize: 10,
            totalPages: 1,
            totalRows: 2,
          },
        ]);
      }
      return route.fulfill({ status: 404, json: { message: `No mock for ${path}` } });
    },
  );
}
