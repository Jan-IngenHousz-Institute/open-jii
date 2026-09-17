import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

import { readEnvFile, repositoryRoot } from "../lib/config.js";

type Fields = Partial<Record<string, Record<string, unknown>>>;
interface Entry {
  sys: {
    id: string;
    version: number;
    publishedVersion?: number;
    contentType: { sys: { id: string } };
  };
  fields: Fields;
  metadata?: unknown;
}
export interface Note {
  locale: string;
  fields: Record<string, unknown>;
}
interface Options {
  action: "inspect" | "draft" | "publish";
  dryRun?: boolean;
  note?: Note;
  entryId?: string;
  version?: number;
}
interface Config {
  space: string;
  environment: string;
  token: string;
}
const contentType = "componentReleaseNote";
const validId = /^[a-zA-Z0-9_.-]{1,64}$/;

class ContentfulError extends Error {
  constructor(
    readonly status: number,
    method: string,
  ) {
    super(`Contentful ${method} returned ${status}; no automatic retry`);
  }
}

function validateNote(value: unknown): asserts value is Note {
  if (
    !value ||
    typeof value !== "object" ||
    !("locale" in value) ||
    typeof value.locale !== "string" ||
    !value.locale.trim()
  ) {
    throw new Error("A note requires a locale");
  }
  if (
    !("fields" in value) ||
    !value.fields ||
    typeof value.fields !== "object" ||
    Array.isArray(value.fields)
  ) {
    throw new Error("A note requires a fields object");
  }
  try {
    Intl.getCanonicalLocales(value.locale);
  } catch {
    throw new Error("Invalid locale syntax; use a locale such as en-US");
  }
  const fields = value.fields as Record<string, unknown>;
  if (typeof fields.slug !== "string" || !fields.slug.trim())
    throw new Error("A note requires a nonempty slug");
  if (
    fields.surfaces !== undefined &&
    (typeof fields.surfaces !== "string" || !["web", "mobile", "both"].includes(fields.surfaces))
  ) {
    throw new Error("surfaces must be the single string web, mobile, or both");
  }
}

async function loadConfig(root: string, env: NodeJS.ProcessEnv): Promise<Config> {
  const file = await readEnvFile(`${root}/.env`);
  const values = { ...file, ...env };
  return {
    space: values.CONTENTFUL_SPACE_ID?.trim() ?? "",
    environment: values.CONTENTFUL_SPACE_ENVIRONMENT?.trim() ?? "",
    token:
      [values.CONTENTFUL_MANAGEMENT_TOKEN, values.CMA]
        .map((value) => value?.trim())
        .find(Boolean) ?? "",
  };
}

export async function releaseCms(
  options: Options,
  config: Config,
  request: typeof fetch = fetch,
): Promise<unknown> {
  const note = options.note;
  if (note) validateNote(note);
  if (options.action === "draft" && !options.note) throw new Error("draft requires --file");
  if (options.entryId && !validId.test(options.entryId)) throw new Error("Invalid entry ID");
  if (
    options.version !== undefined &&
    (!Number.isInteger(options.version) || options.version < 1)
  ) {
    throw new Error("Version must be a positive integer");
  }
  if (options.action === "publish" && (!options.entryId || !options.version)) {
    throw new Error("publish requires --entry-id and --version from the reviewed draft");
  }
  if (options.action === "publish" && options.note)
    throw new Error("publish does not accept --file");
  if (options.dryRun) {
    return {
      dryRun: true,
      networkRequests: 0,
      action: options.action,
      target: { space: config.space || "missing", environment: config.environment || "missing" },
      entryId: options.entryId,
      expectedVersion: options.version,
      input: note,
      validation:
        "Unlocalized input only; environment locale support, live schema, existing entry, and permissions are unchecked",
    };
  }
  const missing = [
    !config.space && "CONTENTFUL_SPACE_ID",
    !config.environment && "CONTENTFUL_SPACE_ENVIRONMENT",
    !config.token && "CONTENTFUL_MANAGEMENT_TOKEN or CMA",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
  if (!validId.test(config.space) || !validId.test(config.environment)) {
    throw new Error("Invalid Contentful space or environment ID");
  }
  const base = `https://api.contentful.com/spaces/${config.space}/environments/${config.environment}`;
  async function api<T>(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await request(`${base}/${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/vnd.contentful.management.v1+json",
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error(`Contentful ${method} failed; inspect the entry before retrying`);
    }
    if (!response.ok) {
      throw new ContentfulError(response.status, method);
    }
    return (await response.json()) as T;
  }
  function checkEntry(entry: Entry): void {
    if (entry.sys.contentType.sys.id !== contentType) {
      throw new Error(
        "Only componentReleaseNote entries are supported; gates require the gate recipe",
      );
    }
  }
  if (options.action === "publish") {
    const path = `entries/${options.entryId}`;
    const current = await api<Entry>(path);
    checkEntry(current);
    if (current.sys.version !== options.version)
      throw new Error("Entry version changed; review it again");
    await api<Entry>(`${path}/published`, "PUT", undefined, {
      "X-Contentful-Version": String(options.version),
    });
    const saved = await api<Entry>(path);
    if (saved.sys.publishedVersion !== options.version) {
      throw new Error("Published version differs; inspect the entry before continuing");
    }
    return saved;
  }
  const schema = await api<{ fields: { id: string; localized: boolean }[] }>(
    `content_types/${contentType}`,
  );
  const locales = await api<{ items: { code: string; default: boolean }[] }>("locales");
  if (options.action === "inspect") {
    const entries = options.entryId
      ? await api<Entry>(`entries/${options.entryId}`)
      : await api<unknown>(`entries?content_type=${contentType}&limit=100`);
    return { schema, locales, entries };
  }
  if (!note) throw new Error("draft requires --file");
  if (!locales.items.some((locale) => locale.code === note.locale))
    throw new Error("Unknown locale");
  const defaultLocale = locales.items.find((locale) => locale.default)?.code;
  if (!defaultLocale) throw new Error("No default locale found");
  for (const key of Object.keys(note.fields)) {
    if (!schema.fields.some((field) => field.id === key))
      throw new Error(`Unknown content field: ${key}`);
  }
  const matches = await api<{ total: number; items: Entry[] }>(
    `entries?content_type=${contentType}&fields.slug=${encodeURIComponent(String(note.fields.slug))}&limit=2`,
  );
  if (matches.total > 1)
    throw new Error("Multiple notes have this slug; resolve the duplicate first");
  const match = matches.items.at(0);
  const derivedId = `release-${createHash("sha256").update(String(note.fields.slug)).digest("hex").slice(0, 32)}`;
  let current: Entry | undefined;
  try {
    current = await api<Entry>(`entries/${options.entryId ?? match?.sys.id ?? derivedId}`);
  } catch (error) {
    if (!(error instanceof ContentfulError && error.status === 404 && !options.entryId && !match)) {
      throw error;
    }
  }
  if (current) checkEntry(current);
  if (current && match && current.sys.id !== match.sys.id) {
    throw new Error("Slug belongs to another entry");
  }
  if (
    current &&
    Object.values(current.fields.slug ?? {}).some((slug) => slug !== note.fields.slug)
  ) {
    throw new Error("Existing slug differs; use the original release identity");
  }
  const id = current?.sys.id ?? derivedId;
  const fields: Fields = structuredClone(current?.fields ?? {});
  for (const [key, value] of Object.entries(note.fields)) {
    const locale = schema.fields.find((field) => field.id === key)?.localized
      ? note.locale
      : defaultLocale;
    fields[key] = { ...fields[key], [locale]: value };
  }
  // An explicit --version asserts what was reviewed, so a stale one is refused before the no-op
  // below: matching fields do not mean the entry is unchanged, and it would be returned as reviewed.
  if (current && options.version !== undefined && current.sys.version !== options.version) {
    throw new Error(
      `Updating an existing note requires its reviewed --version ${current.sys.version}`,
    );
  }
  if (current && isDeepStrictEqual(fields, current.fields)) {
    return { unchanged: true, entry: current };
  }
  if (current && current.sys.version !== options.version) {
    throw new Error(
      `Updating an existing note requires its reviewed --version ${current.sys.version}`,
    );
  }
  if (!current && options.version !== undefined)
    throw new Error("Entry not found for the reviewed version");
  const result = await api<Entry>(
    `entries/${id}`,
    "PUT",
    {
      fields,
      ...(current?.metadata === undefined ? {} : { metadata: current.metadata }),
    },
    {
      "X-Contentful-Content-Type": contentType,
      ...(current ? { "X-Contentful-Version": String(current.sys.version) } : {}),
    },
  );
  const saved = await api<Entry>(`entries/${result.sys.id}`);
  checkEntry(saved);
  if (!isDeepStrictEqual(saved.fields, fields)) {
    throw new Error("Saved fields differ; inspect the entry before continuing");
  }
  return { drafted: true, entry: saved };
}

async function run(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      "entry-id": { type: "string" },
      version: { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  const [action] = positionals;
  if (positionals.length !== 1 || !["preflight", "inspect", "draft", "publish"].includes(action)) {
    throw new Error(
      "Usage: release:cms preflight|inspect|draft|publish [--file <absolute-json-path>] [--entry-id ID] [--version N] [--dry-run]",
    );
  }
  const config = await loadConfig(repositoryRoot(), process.env);
  if (action === "preflight") {
    process.stdout.write(
      `${JSON.stringify({ CONTENTFUL_SPACE_ID: Boolean(config.space), CONTENTFUL_SPACE_ENVIRONMENT: Boolean(config.environment), managementToken: Boolean(config.token) }, null, 2)}\n`,
    );
    return;
  }
  const note: Note | undefined = values.file
    ? (JSON.parse(await readFile(values.file, "utf8")) as Note)
    : undefined;
  const result = await releaseCms(
    {
      action: action as Options["action"],
      note,
      entryId: values["entry-id"],
      version: values.version === undefined ? undefined : Number(values.version),
      dryRun: values["dry-run"],
    },
    config,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Release CMS command failed"}\n`,
    );
    process.exitCode = 1;
  }
}
