import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseArgs as parseNodeArgs } from "node:util";

import type { StatusDocument } from "@repo/monitoring/status-document";
import {
  incidentStatusDocument,
  maintenanceStatusDocument,
  operationalStatusDocument,
  plannedStatusDocument,
  staleStatusDocument,
} from "@repo/monitoring/status-fixtures";

const DATA_PATH = "/data/status.json";
const DEFAULT_PORT = 3031;
// The page's own tests read each sample two minutes after it was generated, when none is stale.
const READ_AFTER_MS = 2 * 60_000;

export const FIXTURES = {
  operational: operationalStatusDocument,
  stale: staleStatusDocument,
  incident: incidentStatusDocument,
  planned: plannedStatusDocument,
  maintenance: maintenanceStatusDocument,
} satisfies Record<string, StatusDocument>;

type FixtureName = keyof typeof FIXTURES;

const usage = `Usage: pnpm status:fixtures [${Object.keys(FIXTURES).join(" | ")}] [--port <n>]`;

function isFixtureName(name: string): name is FixtureName {
  return Object.hasOwn(FIXTURES, name);
}

export interface FixtureArgs {
  name: FixtureName;
  port: number;
}

export function parseArgs(argv: string[]): FixtureArgs {
  const { values, positionals } = parseNodeArgs({
    args: argv[0] === "--" ? argv.slice(1) : argv,
    options: { port: { type: "string" } },
    allowPositionals: true,
  });
  const name = positionals.at(0) ?? "operational";
  const port = Number(values.port ?? DEFAULT_PORT);

  if (positionals.length > 1 || !isFixtureName(name) || !Number.isInteger(port) || port <= 0) {
    throw new Error(usage);
  }
  return { name, port };
}

// The page sets its clock from the response's Date header, so a Date that runs on from the
// sample's own time shows the sample as its tests see it, and it never goes stale.
export class FixtureServer {
  constructor(
    private readonly document: StatusDocument,
    private readonly startedAt = Date.now(),
  ) {}

  dateAt(now: number): string {
    const sampleNow = Date.parse(this.document.generatedAt) + READ_AFTER_MS + now - this.startedAt;
    return new Date(sampleNow).toUTCString();
  }

  handle(request: IncomingMessage, response: ServerResponse): void {
    if (request.url !== DATA_PATH) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Date: this.dateAt(Date.now()),
    });
    response.end(JSON.stringify(this.document));
  }
}

function run(argv: string[]): void {
  const { name, port } = parseArgs(argv);
  const fixtures = new FixtureServer(FIXTURES[name]);

  createServer((request, response) => fixtures.handle(request, response)).listen(port, () => {
    process.stdout.write(
      `Serving the ${name} sample at http://localhost:${port}${DATA_PATH}\n` +
        `Run the page against it with STATUS_DATA_ORIGIN=http://localhost:${port} pnpm --filter status dev\n`,
    );
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  run(process.argv.slice(2));
}
