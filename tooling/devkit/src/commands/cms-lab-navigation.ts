import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { repositoryRoot } from "../lib/config.js";
import {
  ContentfulManagement,
  createContentfulAudit,
  loadContentfulConfig,
} from "../lib/contentful-management.js";
import type { Entry, Locale, Preflight } from "../lib/contentful-management.js";

export const labUrl = "https://lab.openjii.org";
export const labLabel = "openJII Lab";
const internalName = "openJII Lab navigation";
const maxHeaderLinks = 6;

// The public navbar renders navigationButtons and the footer menu renders menuButtons, both from the
// one published footer entry, so the Lab button goes into both lists.
export const footerLists = ["navigationButtons", "menuButtons"] as const;
type FooterList = (typeof footerLists)[number];

type Client = Pick<
  ContentfulManagement,
  | "environment"
  | "preflight"
  | "requireNamedEnvironment"
  | "getEntry"
  | "listEntries"
  | "getLocales"
  | "createEntry"
  | "updateEntry"
  | "publishEntry"
>;

interface Link {
  sys: { type: "Link"; linkType: "Entry"; id: string };
}

export interface FooterSummary {
  id: string;
  version: number;
  publishedVersion: number | null;
}

export interface Plan {
  environment: string;
  footer: FooterSummary;
  button: { id: string; version: number; published: true } | "create";
  add: FooterList[];
  unchanged: boolean;
}

export interface ApplyResult extends Plan {
  applied: boolean;
  footerVersionAfter: number;
}

// The entry schema types every field and locale as present; at runtime either can be missing.
function valueOf(entry: Entry, field: string, locale: string): unknown {
  return Object.hasOwn(entry.fields, field) ? entry.fields[field][locale] : undefined;
}

function linkTo(id: string): Link {
  return { sys: { type: "Link", linkType: "Entry", id } };
}

function linkedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const id = (item as { sys?: { id?: unknown } } | null)?.sys?.id;
    return typeof id === "string" ? [id] : [];
  });
}

// A published entry with no pending edits has version = publishedVersion + 1. Publishing anything
// else would also publish someone's unreviewed draft, so both entries must be clean.
function isCleanlyPublished(entry: Entry): boolean {
  return (
    entry.sys.archivedVersion === undefined &&
    entry.sys.publishedVersion !== undefined &&
    entry.sys.version === entry.sys.publishedVersion + 1
  );
}

function defaultLocaleOf(locales: Locale[]): string {
  const code = locales.find((locale) => locale.default)?.code;
  if (!code) throw new Error("Contentful has no default locale");
  return code;
}

export function buttonFields(locales: Locale[]): Entry["fields"] {
  const fallback = defaultLocaleOf(locales);
  return {
    internalName: { [fallback]: internalName },
    // The product name is the same in every language; label is the only localized button field.
    label: Object.fromEntries(locales.map((locale) => [locale.code, labLabel])),
    url: { [fallback]: labUrl },
  };
}

export class LabNavigation {
  constructor(private readonly client: Client) {}

  preflight(): Preflight {
    return this.client.preflight();
  }

  async footers(): Promise<FooterSummary[]> {
    const list = await this.client.listEntries("footer", { limit: "100" });
    return list.items.map(({ sys }) => ({
      id: sys.id,
      version: sys.version,
      publishedVersion: sys.publishedVersion ?? null,
    }));
  }

  async inspect(footerId: string): Promise<Plan> {
    const footer = await this.client.getEntry(footerId);
    if (footer.sys.contentType.sys.id !== "footer") {
      throw new Error(`Entry ${footerId} is a ${footer.sys.contentType.sys.id}, not a footer`);
    }
    if (!isCleanlyPublished(footer)) {
      throw new Error(
        `Footer ${footerId} has unpublished edits or is not published; publish or discard them in Contentful first, so this command publishes only the Lab button`,
      );
    }

    const locale = defaultLocaleOf(await this.client.getLocales());
    const found = await this.client.listEntries("componentButton", {
      "fields.url": labUrl,
      limit: "10",
    });
    const buttons = found.items.filter((entry) => valueOf(entry, "url", locale) === labUrl);
    if (buttons.length > 1) {
      throw new Error(
        `${buttons.length} buttons already point at ${labUrl}; keep one in Contentful before running this again`,
      );
    }
    const existing = buttons.at(0);
    if (existing && !isCleanlyPublished(existing)) {
      throw new Error(
        `Button ${existing.sys.id} points at ${labUrl} but has unpublished edits or is not published; resolve it in Contentful first`,
      );
    }

    const navigation = valueOf(footer, "navigationButtons", locale);
    const headerLinks = Array.isArray(navigation) ? navigation.length : 0;
    const add = existing
      ? footerLists.filter(
          (list) => !linkedIds(valueOf(footer, list, locale)).includes(existing.sys.id),
        )
      : [...footerLists];

    // footer.json limits the public header to six links, so a seventh would fail on save.
    if (add.includes("navigationButtons") && headerLinks >= maxHeaderLinks) {
      throw new Error(
        `The public header already has ${headerLinks} links, the most it allows; remove one in Contentful first`,
      );
    }

    return {
      environment: this.client.environment,
      footer: {
        id: footer.sys.id,
        version: footer.sys.version,
        publishedVersion: footer.sys.publishedVersion ?? null,
      },
      button: existing
        ? { id: existing.sys.id, version: existing.sys.version, published: true }
        : "create",
      add,
      unchanged: add.length === 0,
    };
  }

  async apply(
    footerId: string,
    reviewedVersion: number,
    environment: string | undefined,
  ): Promise<ApplyResult> {
    this.client.requireNamedEnvironment(environment);
    const plan = await this.inspect(footerId);
    if (plan.footer.version !== reviewedVersion) {
      throw new Error(
        `Footer ${footerId} is at version ${plan.footer.version}, not the reviewed ${reviewedVersion}; inspect it again. Nothing was written.`,
      );
    }
    if (plan.unchanged) {
      return { ...plan, applied: false, footerVersionAfter: plan.footer.version };
    }

    const locales = await this.client.getLocales();
    const locale = defaultLocaleOf(locales);
    let button = plan.button;
    if (button === "create") {
      const created = await this.client.createEntry("componentButton", buttonFields(locales));
      const published = await this.client.publishEntry(created);
      button = { id: published.sys.id, version: published.sys.version, published: true };
    }
    const buttonId = button.id;

    // Re-read so the update carries the footer exactly as it is now, at the version just checked.
    const footer = await this.client.getEntry(footerId);
    if (footer.sys.version !== reviewedVersion) {
      throw new Error(
        `Footer ${footerId} changed while the button was being saved; inspect it again before retrying`,
      );
    }
    const fields: Entry["fields"] = { ...footer.fields };
    for (const list of plan.add) {
      const current = valueOf(footer, list, locale);
      const links: unknown[] = Array.isArray(current) ? current : [];
      fields[list] = {
        ...(Object.hasOwn(footer.fields, list) ? footer.fields[list] : {}),
        [locale]: [...links, linkTo(buttonId)],
      };
    }
    const updated = await this.client.updateEntry(footer, fields);
    const published = await this.client.publishEntry(updated);
    return {
      ...plan,
      button,
      applied: true,
      footerVersionAfter: published.sys.version,
    };
  }
}

const usage =
  "Usage: cms:lab-navigation preflight | inspect [--footer-id ID] | apply --footer-id ID --footer-version N --environment NAME";

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function execute(args: string[], navigation: LabNavigation): Promise<string> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "footer-id": { type: "string" },
      "footer-version": { type: "string" },
      environment: { type: "string" },
    },
  });
  const [action, ...rest] = positionals;
  if (rest.length > 0) throw new Error(usage);

  if (action === "preflight") return toJson(navigation.preflight());

  const footerId = values["footer-id"];
  if (action === "inspect") {
    return toJson(
      footerId === undefined
        ? { footers: await navigation.footers() }
        : await navigation.inspect(footerId),
    );
  }

  if (action === "apply") {
    const version = values["footer-version"];
    if (footerId === undefined || version === undefined || !/^\d+$/.test(version)) {
      throw new Error(`apply needs --footer-id and the reviewed --footer-version. ${usage}`);
    }
    return toJson(await navigation.apply(footerId, Number(version), values.environment));
  }

  throw new Error(usage);
}

async function run(): Promise<void> {
  const root = repositoryRoot();
  const config = await loadContentfulConfig(root, process.env);
  const navigation = new LabNavigation(
    new ContentfulManagement(config, fetch, createContentfulAudit(root)),
  );
  const argv = process.argv.slice(2);
  process.stdout.write(await execute(argv[0] === "--" ? argv.slice(1) : argv, navigation));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "cms:lab-navigation failed"}\n`,
    );
    process.exitCode = 1;
  }
}
