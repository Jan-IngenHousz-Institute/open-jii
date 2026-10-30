import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

import { devkitEnvPath, mainWorktreeRoot, readEnvFile, repositoryRoot } from "../lib/config.js";

const destination = "https://equipment.openjii.org";
const buttonId = "openjii-equipment-navigation";
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
interface Config {
  space: string;
  environment: string;
  token: string;
}
interface Options {
  footerId?: string;
  apply?: boolean;
  listFooters?: boolean;
  footerVersion?: number;
  buttonVersion?: number;
}
const validId = /^[a-zA-Z0-9_.-]{1,64}$/;
const link = { sys: { type: "Link", linkType: "Entry", id: buttonId } };

export async function equipmentNavigation(
  options: Options,
  config: Config,
  request: typeof fetch = fetch,
) {
  const entry = {
    id: buttonId,
    contentType: "componentButton",
    label: "Equipment",
    url: destination,
  };
  if (!options.footerId && !options.apply && !options.listFooters) {
    return {
      dryRun: true,
      networkRequests: 0,
      entry,
      footerFields: ["navigationButtons", "menuButtons"],
      next: "Pass --footer-id from the published footer to inspect its exact changes. No writes occur without --apply.",
    };
  }
  if (!options.listFooters && (!options.footerId || !validId.test(options.footerId)))
    throw new Error("A valid --footer-id is required");
  if (!validId.test(config.space) || !validId.test(config.environment) || !config.token) {
    throw new Error(
      "Configure CONTENTFUL_SPACE_ID, CONTENTFUL_SPACE_ENVIRONMENT and CONTENTFUL_MANAGEMENT_TOKEN or CMA in the devkit environment",
    );
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
      throw new Error(`Contentful ${method} failed; inspect entries before retrying`);
    }
    if (!response.ok)
      throw new Error(
        `Contentful ${method} returned ${response.status}; inspect entries before retrying`,
      );
    return response.json() as Promise<T>;
  }
  if (options.listFooters) {
    if (options.apply) throw new Error("--list-footers cannot be combined with --apply");
    const result = await api<{ items: Entry[] }>("entries?content_type=footer&limit=100");
    return {
      dryRun: true,
      footers: result.items.map(({ sys }) => ({
        id: sys.id,
        version: sys.version,
        publishedVersion: sys.publishedVersion,
      })),
    };
  }
  const footer = await api<Entry>(`entries/${options.footerId}`);
  if (footer.sys.contentType.sys.id !== "footer")
    throw new Error("The selected entry is not a footer");
  if (
    footer.sys.publishedVersion === undefined ||
    footer.sys.version !== footer.sys.publishedVersion + 1
  ) {
    throw new Error(
      "Footer must be published with no pending edits; refusing to publish unrelated content",
    );
  }
  const locales = await api<{ items: { code: string; default: boolean }[] }>("locales");
  const defaultLocale = locales.items.find((locale) => locale.default)?.code;
  if (!defaultLocale) throw new Error("No default Contentful locale");
  const schema = await api<{ fields: { id: string; localized: boolean; required?: boolean }[] }>(
    "content_types/componentButton",
  );
  const fields: Fields = {};
  for (const field of schema.fields) {
    const value =
      field.id === "label"
        ? "Equipment"
        : field.id === "url"
          ? destination
          : field.id === "internalName"
            ? "openJII Equipment navigation"
            : undefined;
    if (value === undefined) {
      if (field.required) throw new Error(`Unsupported required button field: ${field.id}`);
      continue;
    }
    fields[field.id] = Object.fromEntries(
      (field.localized ? locales.items.map((locale) => locale.code) : [defaultLocale]).map(
        (locale) => [locale, value],
      ),
    );
  }
  if (!fields.label || !fields.url) throw new Error("Button schema must have label and url fields");
  const buttons = await api<{ items: Entry[] }>(`entries?sys.id=${buttonId}&limit=1`);
  const button = buttons.items.at(0);
  if (
    button &&
    (button.sys.contentType.sys.id !== "componentButton" ||
      !isDeepStrictEqual(button.fields, fields))
  ) {
    throw new Error(
      "The Equipment entry ID is already used by different content; inspect it before proceeding",
    );
  }
  const nextFields = structuredClone(footer.fields);
  for (const field of ["navigationButtons", "menuButtons"]) {
    const values = nextFields[field];
    if (!values || !Object.keys(values).length)
      throw new Error(`Footer has no ${field} locale; inspect its content model`);
    for (const [locale, value] of Object.entries(values)) {
      if (!Array.isArray(value)) throw new Error(`Footer ${field}.${locale} must be an array`);
      const items: unknown[] = value;
      const present = items.some((item) => {
        if (!item || typeof item !== "object" || !("sys" in item)) return false;
        const sys = item.sys;
        return !!sys && typeof sys === "object" && "id" in sys && sys.id === buttonId;
      });
      if (!present) values[locale] = [...items, link];
    }
  }
  const footerChanged = !isDeepStrictEqual(footer.fields, nextFields);
  const buttonPublished =
    button?.sys.publishedVersion !== undefined &&
    button.sys.version === button.sys.publishedVersion + 1;
  const plan = {
    dryRun: !options.apply,
    target: { space: config.space, environment: config.environment },
    button: { ...entry, observedVersion: button?.sys.version ?? 0, fields },
    footer: { id: footer.sys.id, observedVersion: footer.sys.version, fields: nextFields },
    footerChanged,
    buttonPublished,
  };
  if (!options.apply || (!footerChanged && buttonPublished)) return plan;
  if (
    options.footerVersion !== footer.sys.version ||
    (options.buttonVersion ?? 0) !== (button?.sys.version ?? 0)
  ) {
    throw new Error(
      "Pass --footer-version and --button-version from the reviewed dry run (0 for a new button)",
    );
  }
  let domain: Response;
  try {
    domain = await request(destination, {
      method: "HEAD",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Equipment public origin is unavailable; no CMS writes performed");
  }
  if (!domain.ok)
    throw new Error("Equipment public origin is unavailable; no CMS writes performed");
  let currentButton = button;
  currentButton ??= await api<Entry>(
    `entries/${buttonId}`,
    "PUT",
    { fields },
    { "X-Contentful-Content-Type": "componentButton" },
  );
  if (!buttonPublished)
    await api<Entry>(`entries/${buttonId}/published`, "PUT", undefined, {
      "X-Contentful-Version": String(currentButton.sys.version),
    });
  if (footerChanged) {
    const updated = await api<Entry>(
      `entries/${footer.sys.id}`,
      "PUT",
      { fields: nextFields, ...(footer.metadata ? { metadata: footer.metadata } : {}) },
      { "X-Contentful-Version": String(footer.sys.version) },
    );
    await api<Entry>(`entries/${footer.sys.id}/published`, "PUT", undefined, {
      "X-Contentful-Version": String(updated.sys.version),
    });
  }
  return { ...plan, applied: true };
}

async function main() {
  const { values } = parseArgs({
    options: {
      "footer-id": { type: "string" },
      "list-footers": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      "footer-version": { type: "string" },
      "button-version": { type: "string" },
    },
    strict: true,
  });
  const root = repositoryRoot();
  const mainRoot = await mainWorktreeRoot(root);
  const env = {
    ...(mainRoot ? await readEnvFile(devkitEnvPath(mainRoot)) : {}),
    ...(await readEnvFile(devkitEnvPath(root))),
    ...process.env,
  };
  const result = await equipmentNavigation(
    {
      footerId: values["footer-id"],
      apply: values.apply,
      listFooters: values["list-footers"],
      footerVersion:
        values["footer-version"] === undefined ? undefined : Number(values["footer-version"]),
      buttonVersion:
        values["button-version"] === undefined ? undefined : Number(values["button-version"]),
    },
    {
      space: env.CONTENTFUL_SPACE_ID?.trim() ?? "",
      environment: env.CONTENTFUL_SPACE_ENVIRONMENT?.trim() ?? "",
      token:
        [env.CONTENTFUL_MANAGEMENT_TOKEN, env.CMA].map((value) => value?.trim()).find(Boolean) ??
        "",
    },
  );
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Equipment navigation failed");
    process.exitCode = 1;
  });
}
