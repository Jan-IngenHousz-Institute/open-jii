import { z } from "zod";

import { devkitEnvPath, readEnvFile } from "./config.js";
import { ContentModel } from "./content-model.js";
import type { LiveContentType } from "./content-model.js";
import { EditorInterface } from "./editor-interface.js";

export interface ContentfulConfig {
  space: string;
  environment: string;
  token: string;
}

export interface Preflight {
  CONTENTFUL_SPACE_ID: boolean;
  CONTENTFUL_SPACE_ENVIRONMENT: boolean;
  managementToken: boolean;
  environment: string | null;
}

const validId = /^[a-zA-Z0-9_.-]{1,64}$/;

const entrySchema = z.object({
  sys: z.object({
    id: z.string(),
    version: z.number().int(),
    publishedVersion: z.number().int().optional(),
    archivedVersion: z.number().int().optional(),
    contentType: z.object({ sys: z.object({ id: z.string() }) }),
  }),
  fields: z.record(z.string(), z.record(z.string(), z.unknown())),
  metadata: z.unknown().optional(),
});

const entryListSchema = z.object({ total: z.number(), items: z.array(entrySchema) });

export type Entry = z.output<typeof entrySchema>;
export type EntryList = z.output<typeof entryListSchema>;

interface SendOptions {
  body?: unknown;
  version?: number | null;
  contentType?: string;
}

const errorBodySchema = z.looseObject({
  sys: z.looseObject({ id: z.string() }).optional(),
  message: z.string().optional(),
  details: z
    .looseObject({
      errors: z
        .array(z.looseObject({ name: z.string().optional(), details: z.unknown() }))
        .optional(),
    })
    .optional(),
});

export class ContentfulError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function loadContentfulConfig(
  root: string,
  env: NodeJS.ProcessEnv,
): Promise<ContentfulConfig> {
  const file = await readEnvFile(devkitEnvPath(root));
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

export class ContentfulManagement {
  constructor(
    private readonly config: ContentfulConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  get environment(): string {
    return this.config.environment;
  }

  preflight(): Preflight {
    return {
      CONTENTFUL_SPACE_ID: Boolean(this.config.space),
      CONTENTFUL_SPACE_ENVIRONMENT: Boolean(this.config.environment),
      managementToken: Boolean(this.config.token),
      environment: this.config.environment || null,
    };
  }

  async getContentType(id: string): Promise<LiveContentType | null> {
    try {
      const body = await this.send("GET", this.typePath(id));
      return ContentModel.fromLive(body, `The live ${id} content type`);
    } catch (error) {
      if (error instanceof ContentfulError && error.status === 404) return null;
      throw error;
    }
  }

  async putContentType(
    id: string,
    body: unknown,
    version: number | null,
  ): Promise<LiveContentType> {
    const response = await this.send("PUT", this.typePath(id), { body, version });
    return ContentModel.fromLive(response, `The saved ${id} content type`);
  }

  async activateContentType(id: string, version: number): Promise<LiveContentType> {
    const response = await this.send("PUT", `${this.typePath(id)}/published`, { version });
    return ContentModel.fromLive(response, `The activated ${id} content type`);
  }

  async getEntry(id: string): Promise<Entry> {
    return this.receive("GET", this.entryPath(id), entrySchema);
  }

  async listEntries(contentType: string, query: Record<string, string> = {}): Promise<EntryList> {
    const search = new URLSearchParams({ content_type: contentType, ...query });
    return this.receive("GET", `entries?${search}`, entryListSchema);
  }

  async createEntry(contentType: string, fields: Entry["fields"]): Promise<Entry> {
    return this.receive("POST", "entries", entrySchema, { body: { fields }, contentType });
  }

  async updateEntry(entry: Entry, fields: Entry["fields"]): Promise<Entry> {
    const body = { fields, ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }) };
    return this.receive("PUT", this.entryPath(entry.sys.id), entrySchema, {
      body,
      version: entry.sys.version,
    });
  }

  async publishEntry(entry: Entry): Promise<Entry> {
    return this.receive("PUT", `${this.entryPath(entry.sys.id)}/published`, entrySchema, {
      version: entry.sys.version,
    });
  }

  async getEditorInterface(id: string): Promise<EditorInterface> {
    const response = await this.send("GET", `${this.typePath(id)}/editor_interface`);
    return EditorInterface.fromResponse(response, `The ${id} editor interface`);
  }

  async putEditorInterface(id: string, editorInterface: EditorInterface): Promise<void> {
    await this.send("PUT", `${this.typePath(id)}/editor_interface`, {
      body: editorInterface.requestBody(),
      version: editorInterface.version,
    });
  }

  static requireEntryId(id: string): void {
    if (!validId.test(id)) {
      throw new Error("Invalid entry ID");
    }
  }

  requireConfig(): void {
    const { space, environment, token } = this.config;
    const missing = [
      !space && "CONTENTFUL_SPACE_ID",
      !environment && "CONTENTFUL_SPACE_ENVIRONMENT",
      !token && "CONTENTFUL_MANAGEMENT_TOKEN or CMA",
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Missing: ${missing.join(", ")}`);
    }
    if (!validId.test(space) || !validId.test(environment)) {
      throw new Error("Invalid Contentful space or environment ID");
    }
  }

  requireNamedEnvironment(named: string | undefined): void {
    const { environment } = this.config;

    if (named === undefined || named === "") {
      throw new Error(
        "This writes to Contentful, so name the environment with --environment <name>. It must equal CONTENTFUL_SPACE_ENVIRONMENT, and nothing was written.",
      );
    }
    if (named !== environment) {
      throw new Error(
        `--environment ${named} is not the configured environment ${environment}, so nothing was written.`,
      );
    }
  }

  private typePath(id: string): string {
    return `content_types/${encodeURIComponent(id)}`;
  }

  private entryPath(id: string): string {
    ContentfulManagement.requireEntryId(id);
    return `entries/${encodeURIComponent(id)}`;
  }

  private base(): string {
    this.requireConfig();
    const { space, environment } = this.config;
    return `https://api.contentful.com/spaces/${space}/environments/${environment}`;
  }

  private async receive<S extends z.ZodType>(
    method: "GET" | "POST" | "PUT",
    path: string,
    schema: S,
    options: SendOptions = {},
  ): Promise<z.output<S>> {
    const parsed = schema.safeParse(await this.send(method, path, options));

    if (!parsed.success) {
      throw new Error(
        `Contentful ${method} ${ContentfulManagement.resourceOf(path)} answered with an unexpected shape`,
      );
    }

    return parsed.data;
  }

  private static resourceOf(path: string): string {
    return path.split("?")[0] ?? path;
  }

  private async send(
    method: "GET" | "POST" | "PUT",
    path: string,
    options: SendOptions = {},
  ): Promise<unknown> {
    const url = `${this.base()}/${path}`;
    const resource = ContentfulManagement.resourceOf(path);
    const hasBody = options.body !== undefined;

    let response: Response;
    try {
      response = await this.request(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          ...(hasBody ? { "Content-Type": "application/vnd.contentful.management.v1+json" } : {}),
          ...(typeof options.version === "number"
            ? { "X-Contentful-Version": String(options.version) }
            : {}),
          ...(options.contentType === undefined
            ? {}
            : { "X-Contentful-Content-Type": options.contentType }),
        },
        ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch {
      throw new Error(
        `Contentful ${method} ${resource} failed before a response; check what was saved before retrying`,
      );
    }

    if (!response.ok) {
      throw await this.failure(method, resource, response);
    }

    const body: unknown = await response.json().catch(() => undefined);
    return body;
  }

  private async failure(
    method: string,
    resource: string,
    response: Response,
  ): Promise<ContentfulError> {
    const detail = await this.describe(response);
    const message = `Contentful ${method} ${resource} returned ${response.status}${detail}; not retried`;
    return new ContentfulError(response.status, this.redact(message));
  }

  private async describe(response: Response): Promise<string> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return "";
    }

    const parsed = errorBodySchema.safeParse(body);
    if (!parsed.success) return "";

    const { sys, message, details } = parsed.data;
    const problems = (details?.errors ?? [])
      .slice(0, 5)
      .map((error) =>
        [error.name, typeof error.details === "string" ? error.details : undefined]
          .filter(Boolean)
          .join(": "),
      )
      .filter(Boolean);
    const summary = [sys?.id, message].filter(Boolean).join(": ");
    const suffix = problems.length > 0 ? ` (${problems.join("; ")})` : "";
    return summary ? ` ${summary}${suffix}` : suffix;
  }

  private redact(text: string): string {
    return this.config.token ? text.replaceAll(this.config.token, "[redacted]") : text;
  }
}
