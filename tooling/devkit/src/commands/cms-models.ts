import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { repositoryRoot } from "../lib/config.js";
import { ContentModel } from "../lib/content-model.js";
import type {
  LiveContentType,
  ModelDiff,
  PropertyChange,
  PublishedState,
} from "../lib/content-model.js";
import {
  ContentfulManagement,
  createContentfulAudit,
  loadContentfulConfig,
} from "../lib/contentful-management.js";
import type { Preflight } from "../lib/contentful-management.js";
import { dateControl } from "../lib/editor-interface.js";

export interface ModelReport {
  id: string;
  missing: boolean;
  liveVersion: number;
  publishedVersion: number | null;
  state: "missing" | PublishedState;
  identical: boolean;
  properties: PropertyChange[];
  displayField: ModelDiff["displayField"];
  fields: Pick<ModelDiff, "added" | "removed" | "changed" | "reordered">;
  kept: string[];
}

export interface DiffReport {
  environment: string | null;
  models: ModelReport[];
}

export interface PullResult {
  id: string;
  path: string;
  liveVersion: number;
  state: PublishedState;
  notExpressed: string[];
}

export interface ApplyResult {
  id: string;
  environment: string;
  contentType: "created" | "updated" | "unchanged";
  liveVersion: number;
  publishedVersion: number | null;
  editorInterface: "updated" | "unchanged" | "not needed";
  stillDiffers: boolean;
  kept: string[];
}

export interface ApplyPlan {
  dryRun: true;
  readsContentful: true;
  writes: 0;
  id: string;
  environment: string;
  expectedVersion: number;
  keptFromLive: string[];
  checksAtApply: string[];
  requests: unknown[];
}

const modelId = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class ModelFiles {
  constructor(private readonly directory: string) {}

  path(id: string): string {
    if (!modelId.test(id)) throw new Error(`Invalid content type id: ${id}`);
    return join(this.directory, `${id}.json`);
  }

  async ids(): Promise<string[]> {
    const names = await readdir(this.directory);
    return names
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort();
  }

  async exists(id: string): Promise<boolean> {
    try {
      await access(this.path(id));
      return true;
    } catch (error) {
      if (hasCode(error, "ENOENT")) return false;
      throw error;
    }
  }

  async read(id: string): Promise<ContentModel> {
    const path = this.path(id);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (hasCode(error, "ENOENT")) throw new Error(`No model file for ${id}: expected ${path}`);
      throw error;
    }
    return ContentModel.fromFile(text, `${id}.json`);
  }

  async write(id: string, model: ContentModel): Promise<string> {
    const path = this.path(id);
    await writeFile(path, model.serialize());
    return path;
  }
}

export class CmsModels {
  constructor(
    private readonly files: ModelFiles,
    private readonly client: ContentfulManagement,
  ) {}

  preflight(): Preflight {
    return this.client.preflight();
  }

  async diff(requested: string[]): Promise<DiffReport> {
    const ids = requested.length > 0 ? requested : await this.files.ids();

    const models: ModelReport[] = [];
    for (const id of ids) {
      const model = await this.files.read(id);
      const live = await this.client.getContentType(id);
      models.push(CmsModels.report(id, model, live));
    }
    return { environment: this.client.environment || null, models };
  }

  async pull(id: string, options: { force: boolean }): Promise<PullResult> {
    const target = this.files.path(id);
    if (!options.force && (await this.files.exists(id))) {
      throw new Error(
        `${target} already exists; review the live type with diff, then pass --force to overwrite it`,
      );
    }

    const live = await this.client.getContentType(id);
    if (live === null) {
      throw new Error(`${id} does not exist live in the ${this.client.environment} environment`);
    }

    const path = await this.files.write(id, live.model);
    return {
      id,
      path,
      liveVersion: live.version,
      state: live.state,
      notExpressed: live.unexpressed,
    };
  }

  async plan(id: string, expectedVersion: number): Promise<ApplyPlan> {
    const model = await this.files.read(id);
    const live = await this.client.getContentType(id);
    this.requireVersion(id, live, expectedVersion);

    return this.buildPlan(id, model, live, expectedVersion);
  }

  async apply(
    id: string,
    expectedVersion: number,
    environment: string | undefined,
  ): Promise<ApplyResult> {
    this.client.requireConfig();
    this.client.requireNamedEnvironment(environment);

    const model = await this.files.read(id);

    const live = await this.client.getContentType(id);
    this.requireVersion(id, live, expectedVersion);

    await this.requireLinkedTypes(id, model);

    const diff = live === null ? null : model.diff(live.model);
    const removed = diff?.removed ?? [];
    if (removed.length > 0) {
      throw new Error(
        `The live ${id} has fields the file lacks (${removed.join(", ")}). Applying would remove them, so omit and delete them in Contentful first, or pull the type to keep them.`,
      );
    }

    const isCurrent = live !== null && diff?.identical === true;
    const saved = isCurrent
      ? live
      : await this.client.putContentType(id, model.requestBodyKeeping(live), live?.version ?? null);
    const activated =
      isCurrent && saved.state === "published"
        ? saved
        : await this.client.activateContentType(id, saved.version);

    const editorInterface = await this.applyEditorInterface(id, model, activated);

    let contentType: ApplyResult["contentType"] = "unchanged";
    if (!isCurrent) contentType = live === null ? "created" : "updated";

    return {
      id,
      environment: this.client.environment,
      contentType,
      liveVersion: activated.version,
      publishedVersion: activated.publishedVersion,
      editorInterface,
      stillDiffers: !model.diff(activated.model).identical,
      kept: live?.unexpressed ?? [],
    };
  }

  private requireVersion(id: string, live: LiveContentType | null, expectedVersion: number): void {
    const liveVersion = live?.version ?? 0;
    if (liveVersion !== expectedVersion) {
      throw new Error(
        `The live ${id} is at version ${liveVersion}, not ${expectedVersion}. Run diff again and review it before applying.`,
      );
    }
  }

  private static report(
    id: string,
    model: ContentModel,
    live: LiveContentType | null,
  ): ModelReport {
    if (live === null) {
      return {
        id,
        missing: true,
        liveVersion: 0,
        publishedVersion: null,
        state: "missing",
        identical: false,
        properties: [],
        displayField: { file: model.displayField, live: null, differs: true },
        fields: { added: model.fieldIds(), removed: [], changed: [], reordered: false },
        kept: [],
      };
    }

    const diff = model.diff(live.model);
    return {
      id,
      missing: false,
      liveVersion: live.version,
      publishedVersion: live.publishedVersion,
      state: live.state,
      identical: diff.identical,
      properties: diff.properties,
      displayField: diff.displayField,
      fields: {
        added: diff.added,
        removed: diff.removed,
        changed: diff.changed,
        reordered: diff.reordered,
      },
      kept: live.unexpressed,
    };
  }

  private async requireLinkedTypes(id: string, model: ContentModel): Promise<void> {
    const missing: string[] = [];
    for (const linked of model.linkedTypes().filter((type) => type !== id)) {
      if ((await this.client.getContentType(linked)) === null) missing.push(linked);
    }
    if (missing.length > 0) {
      throw new Error(
        `${id} links to ${missing.join(", ")}, which ${missing.length > 1 ? "do" : "does"} not exist live, and Contentful rejects a link validation to a missing type. Apply ${missing.join(", ")} first.`,
      );
    }
  }

  private async applyEditorInterface(
    id: string,
    model: ContentModel,
    activated: LiveContentType,
  ): Promise<ApplyResult["editorInterface"]> {
    const dateFields = model.dateFieldIds();
    if (dateFields.length === 0) return "not needed";

    try {
      const current = await this.client.getEditorInterface(id);
      const desired = current.withDateControls(dateFields);
      if (desired.equals(current)) return "unchanged";

      await this.client.putEditorInterface(id, desired);
      return "updated";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The request failed";
      throw new Error(
        `${reason}. The ${id} content type was saved and activated (live version ${activated.version}, published version ${activated.publishedVersion}), but its editor interface was not set, so its Date fields may lack the date and time with time zone widget. A rerun is safe: pnpm cms:models apply ${id} --expected-version ${activated.version} --environment <environment> finds the type matching the file and only repeats the editor interface step.`,
      );
    }
  }

  private buildPlan(
    id: string,
    model: ContentModel,
    live: LiveContentType | null,
    expectedVersion: number,
  ): ApplyPlan {
    const dateFields = model.dateFieldIds();
    const editorInterface = [
      { method: "GET", path: `content_types/${id}/editor_interface` },
      {
        method: "PUT",
        path: `content_types/${id}/editor_interface`,
        headers: { "X-Contentful-Version": "<version of the editor interface read above>" },
        body: { controls: dateFields.map((fieldId) => dateControl(fieldId)) },
        merge:
          "These controls replace or join the live ones. Every other control and key is kept from the GET.",
        skippedWhen: "the live controls already match",
      },
    ];

    return {
      dryRun: true,
      readsContentful: true,
      writes: 0,
      id,
      environment: this.client.environment,
      expectedVersion,
      keptFromLive: live?.unexpressed ?? [],
      checksAtApply: [
        `the live version of ${id} is ${expectedVersion}`,
        ...model
          .linkedTypes()
          .filter((type) => type !== id)
          .map((type) => `${type} exists live`),
        `the live ${id} has no field that the file lacks`,
      ],
      requests: [
        {
          method: "PUT",
          path: `content_types/${id}`,
          headers: expectedVersion === 0 ? {} : { "X-Contentful-Version": String(expectedVersion) },
          body: model.requestBodyKeeping(live),
          skippedWhen: "the live type already matches the file",
        },
        {
          method: "PUT",
          path: `content_types/${id}/published`,
          headers: { "X-Contentful-Version": "<version of the content type saved above>" },
          skippedWhen: "the live type matches the file and is already published",
        },
        ...(dateFields.length > 0 ? editorInterface : []),
      ],
    };
  }
}

function show(value: unknown): string {
  return value === undefined ? "(none)" : JSON.stringify(value);
}

function describeModel(report: ModelReport): string[] {
  const lines: string[] = [];

  if (report.displayField.differs && !report.missing) {
    lines.push(
      `  display field: file ${show(report.displayField.file)}, live ${show(report.displayField.live)}`,
    );
  }
  for (const change of report.properties) {
    lines.push(`  ${change.property}: file ${show(change.file)}, live ${show(change.live)}`);
  }
  for (const id of report.fields.added) lines.push(`  + field ${id} (in the file, not live)`);
  for (const id of report.fields.removed) lines.push(`  - field ${id} (live, not in the file)`);
  for (const field of report.fields.changed) {
    lines.push(`  ~ field ${field.id}`);
    for (const change of field.changes) {
      lines.push(`      ${change.property}: file ${show(change.file)}, live ${show(change.live)}`);
    }
  }
  if (report.fields.reordered) lines.push("  fields are in a different order");
  if (report.kept.length > 0) {
    lines.push(
      `  kept from the live type, which the repo format cannot express: ${report.kept.join(", ")}`,
    );
  }

  return lines;
}

function describePublished(report: ModelReport): string {
  if (report.publishedVersion === null) return "never published";
  const published = `published version ${report.publishedVersion}`;
  return report.state === "changed" ? `${published} with later unpublished changes` : published;
}

function describeHeadline(report: ModelReport): string {
  if (report.missing) return `${report.id}: missing live (apply with --expected-version 0)`;

  const published = describePublished(report);
  const verdict = report.identical ? "identical" : "differs";
  return `${report.id}: live version ${report.liveVersion}, ${published}, ${verdict}`;
}

export function formatDiff(report: DiffReport): string {
  const blocks = report.models.map((model) => {
    const lines = [describeHeadline(model), ...describeModel(model)];
    const isApplicable = !model.identical && !model.missing;
    if (isApplicable) lines.push(`  apply with --expected-version ${model.liveVersion}`);
    return lines.join("\n");
  });
  const heading = `Environment: ${report.environment ?? "not set"}`;
  return `${[heading, ...blocks].join("\n\n")}\n`;
}

export function formatPull(result: PullResult): string {
  const lines = [
    `Wrote ${result.path} from live version ${result.liveVersion} (${result.state}).`,
    "Review it with git diff before committing.",
  ];
  if (result.notExpressed.length > 0) {
    lines.push(
      `Left out, because the repo format does not express it: ${result.notExpressed.join(", ")}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function formatApply(result: ApplyResult): string {
  const published =
    result.publishedVersion === null
      ? "not published"
      : `published version ${result.publishedVersion}`;
  const lines = [
    `Applied ${result.id} to the ${result.environment} environment.`,
    `  content type: ${result.contentType}, live version ${result.liveVersion}, ${published}`,
    `  editor interface: ${result.editorInterface}`,
  ];
  if (result.kept.length > 0) {
    lines.push(`  kept from the live type: ${result.kept.join(", ")}`);
  }
  if (result.stillDiffers) lines.push("  The live type still differs from the file; run diff.");
  return `${lines.join("\n")}\n`;
}

const usage =
  "Usage: cms:models preflight | diff [id ...] [--json] | pull <id> [--force] | apply <id> --expected-version <n> --dry-run [--json] | apply <id> --expected-version <n> --environment <name> [--json]";

const flagsByAction = new Map<string, string[]>([
  ["preflight", []],
  ["diff", ["json"]],
  ["pull", ["force", "json"]],
  ["apply", ["expected-version", "dry-run", "environment", "json"]],
]);

function parseExpectedVersion(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(
      "apply requires --expected-version <n>, the live version diff shows (0 for a type that does not exist yet)",
    );
  }
  return Number(value);
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function execute(args: string[], models: CmsModels): Promise<string> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      force: { type: "boolean" },
      "dry-run": { type: "boolean" },
      "expected-version": { type: "string" },
      environment: { type: "string" },
    },
  });

  const [action = "", ...ids] = positionals;
  const allowed = flagsByAction.get(action);
  if (allowed === undefined) throw new Error(usage);

  const stray = Object.keys(values).filter((flag) => !allowed.includes(flag));
  if (stray.length > 0) {
    throw new Error(`--${stray.join(", --")} does not apply to ${action}. ${usage}`);
  }

  const expectsOneId = action === "pull" || action === "apply";
  if (expectsOneId && ids.length !== 1) throw new Error(usage);
  if (action === "preflight" && ids.length > 0) throw new Error(usage);

  if (action === "preflight") return toJson(models.preflight());

  if (action === "diff") {
    const report = await models.diff(ids);
    return values.json ? toJson(report) : formatDiff(report);
  }

  const [id = ""] = ids;

  if (action === "pull") {
    const result = await models.pull(id, { force: values.force === true });
    return values.json ? toJson(result) : formatPull(result);
  }

  const expectedVersion = parseExpectedVersion(values["expected-version"]);
  if (values["dry-run"]) return toJson(await models.plan(id, expectedVersion));

  const result = await models.apply(id, expectedVersion, values.environment);
  return values.json ? toJson(result) : formatApply(result);
}

async function run(): Promise<void> {
  const root = repositoryRoot();
  const config = await loadContentfulConfig(root, process.env);
  const models = new CmsModels(
    new ModelFiles(join(root, "packages/cms/content-models")),
    new ContentfulManagement(config, fetch, createContentfulAudit(root)),
  );
  const argv = process.argv.slice(2);
  process.stdout.write(await execute(argv[0] === "--" ? argv.slice(1) : argv, models));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "cms:models failed"}\n`);
    process.exitCode = 1;
  }
}
