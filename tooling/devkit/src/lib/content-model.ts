import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

export type Validation = Record<string, unknown>;

export interface ModelItems {
  type: string;
  validations: Validation[];
  linkType?: string;
}

export interface ModelField {
  id: string;
  name: string;
  type: string;
  localized: boolean;
  required: boolean;
  validations: Validation[];
  disabled: boolean;
  omitted: boolean;
  linkType?: string;
  items?: ModelItems;
}

export interface PropertyChange {
  property: string;
  file: unknown;
  live: unknown;
}

export interface FieldChange {
  id: string;
  changes: PropertyChange[];
}

export interface ModelDiff {
  identical: boolean;
  properties: PropertyChange[];
  displayField: { file: string | null; live: string | null; differs: boolean };
  added: string[];
  removed: string[];
  changed: FieldChange[];
  reordered: boolean;
}

export type PublishedState = "draft" | "published" | "changed";

/** The live keys the repo format cannot express, which a save has to send back to keep them. */
export interface KeptKeys {
  type: Record<string, unknown>;
  fields: Map<string, { field: Record<string, unknown>; items: Record<string, unknown> }>;
}

export interface LiveContentType {
  model: ContentModel;
  version: number;
  publishedVersion: number | null;
  state: PublishedState;
  unexpressed: string[];
  kept: KeptKeys;
}

const validationList = z.array(z.record(z.string(), z.unknown())).default([]);

const itemsSchema = z.looseObject({
  type: z.string(),
  validations: validationList,
  linkType: z.string().optional(),
});

const fieldSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  localized: z.boolean().default(false),
  required: z.boolean().default(false),
  validations: validationList,
  disabled: z.boolean().default(false),
  omitted: z.boolean().default(false),
  linkType: z.string().optional(),
  items: itemsSchema.optional(),
});

const modelShape = {
  name: z.string(),
  description: z.string().nullish(),
  displayField: z.string().nullish(),
  fields: z.array(fieldSchema),
};

const fileSchema = z.looseObject(modelShape);

const liveSchema = z.looseObject({
  ...modelShape,
  sys: z.looseObject({
    version: z.number().int(),
    publishedVersion: z.number().int().optional(),
  }),
});

type ParsedField = z.output<typeof fieldSchema>;

const modelKeys = Object.keys(modelShape);
const fieldKeys = Object.keys(fieldSchema.shape);
const itemsKeys = Object.keys(itemsSchema.shape);

const printWidth = 100;

export function parseWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
  label: string,
): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  throw new Error(`${label} is not in the expected shape: ${issues.join("; ")}`);
}

function extraKeys(value: object, known: readonly string[], prefix: string): string[] {
  return Object.keys(value)
    .filter((key) => !known.includes(key))
    .map((key) => `${prefix}${key}`);
}

function keysOutside(value: object, known: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !known.includes(key)));
}

function keptKeys(parsed: { fields: ParsedField[] }, topLevel: readonly string[]): KeptKeys {
  return {
    type: keysOutside(parsed, topLevel),
    fields: new Map(
      parsed.fields.map((field) => [
        field.id,
        {
          field: keysOutside(field, fieldKeys),
          items: field.items ? keysOutside(field.items, itemsKeys) : {},
        },
      ]),
    ),
  };
}

function unexpressedKeys(parsed: { fields: ParsedField[] }, topLevel: readonly string[]): string[] {
  const fieldPaths = parsed.fields.flatMap((field) => [
    ...extraKeys(field, fieldKeys, `fields.${field.id}.`),
    ...(field.items ? extraKeys(field.items, itemsKeys, `fields.${field.id}.items.`) : []),
  ]);
  return [...extraKeys(parsed, topLevel, ""), ...fieldPaths];
}

function toItems(parsed: NonNullable<ParsedField["items"]>): ModelItems {
  return {
    type: parsed.type,
    validations: parsed.validations,
    ...(parsed.linkType === undefined ? {} : { linkType: parsed.linkType }),
  };
}

function toField(parsed: ParsedField): ModelField {
  return {
    id: parsed.id,
    name: parsed.name,
    type: parsed.type,
    localized: parsed.localized,
    required: parsed.required,
    validations: parsed.validations,
    disabled: parsed.disabled,
    omitted: parsed.omitted,
    ...(parsed.linkType === undefined ? {} : { linkType: parsed.linkType }),
    ...(parsed.items === undefined ? {} : { items: toItems(parsed.items) }),
  };
}

function publishedState(version: number, publishedVersion: number | null): PublishedState {
  if (publishedVersion === null) return "draft";
  return version === publishedVersion + 1 ? "published" : "changed";
}

function fieldChanges(file: ModelField, live: ModelField): PropertyChange[] {
  const pairs: [string, unknown, unknown][] = [
    ["name", file.name, live.name],
    ["type", file.type, live.type],
    ["linkType", file.linkType, live.linkType],
    ["localized", file.localized, live.localized],
    ["required", file.required, live.required],
    ["validations", file.validations, live.validations],
    ["disabled", file.disabled, live.disabled],
    ["omitted", file.omitted, live.omitted],
  ];

  if (file.items && live.items) {
    pairs.push(
      ["items.type", file.items.type, live.items.type],
      ["items.linkType", file.items.linkType, live.items.linkType],
      ["items.validations", file.items.validations, live.items.validations],
    );
  } else {
    pairs.push(["items", file.items, live.items]);
  }

  return pairs
    .filter(([, fileValue, liveValue]) => !isDeepStrictEqual(fileValue, liveValue))
    .map(([property, fileValue, liveValue]) => ({ property, file: fileValue, live: liveValue }));
}

function isScalar(value: unknown): boolean {
  return typeof value !== "object" || value === null;
}

// The repo's model files escape non-ASCII, as Contentful's own export does.
function scalar(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function pad(indent: number): string {
  return " ".repeat(indent);
}

// Mirrors prettier on JSON: objects always expanded, arrays of scalars inline while they fit.
function render(value: unknown, indent: number, column: number, trailing: number): string {
  if (Array.isArray(value)) return renderArray(value, indent, column, trailing);
  if (typeof value === "object" && value !== null) return renderObject(value, indent);
  return scalar(value);
}

function renderArray(items: unknown[], indent: number, column: number, trailing: number): string {
  if (items.length === 0) return "[]";

  if (items.every(isScalar)) {
    const inline = `[${items.map(scalar).join(", ")}]`;
    if (column + inline.length + trailing <= printWidth) return inline;
  }

  const inner = indent + 2;
  const lines = items.map((item, index) =>
    render(item, inner, inner, index === items.length - 1 ? 0 : 1),
  );
  return `[\n${lines.map((line) => `${pad(inner)}${line}`).join(",\n")}\n${pad(indent)}]`;
}

function renderObject(value: object, indent: number): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";

  const inner = indent + 2;
  const lines = entries.map(([key, entry], index) => {
    const prefix = `${scalar(key)}: `;
    const trailing = index === entries.length - 1 ? 0 : 1;
    return `${pad(inner)}${prefix}${render(entry, inner, inner + prefix.length, trailing)}`;
  });
  return `{\n${lines.join(",\n")}\n${pad(indent)}}`;
}

export class ContentModel {
  constructor(
    readonly name: string,
    readonly description: string,
    readonly displayField: string | null,
    readonly fields: readonly ModelField[],
  ) {}

  static fromFile(text: string, label: string): ContentModel {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error(`${label} is not valid JSON`);
    }
    const parsed = parseWith(fileSchema, raw, label);

    const unrecognised = unexpressedKeys(parsed, modelKeys);
    if (unrecognised.length > 0) {
      throw new Error(
        `${label} has keys the content model format does not have: ${unrecognised.join(", ")}`,
      );
    }

    const model = ContentModel.fromParsed(parsed);
    const ids = model.fields.map((field) => field.id);
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate !== undefined) throw new Error(`${label} lists the field ${duplicate} twice`);
    if (model.displayField !== null && !ids.includes(model.displayField)) {
      throw new Error(
        `${label} names ${model.displayField} as its display field, but has no such field`,
      );
    }
    return model;
  }

  static fromLive(value: unknown, label: string): LiveContentType {
    const parsed = parseWith(liveSchema, value, label);
    const version = parsed.sys.version;
    const publishedVersion = parsed.sys.publishedVersion ?? null;
    return {
      model: ContentModel.fromParsed(parsed),
      version,
      publishedVersion,
      state: publishedState(version, publishedVersion),
      unexpressed: unexpressedKeys(parsed, [...modelKeys, "sys"]),
      kept: keptKeys(parsed, [...modelKeys, "sys"]),
    };
  }

  private static fromParsed(parsed: z.output<typeof fileSchema>): ContentModel {
    return new ContentModel(
      parsed.name,
      parsed.description ?? "",
      parsed.displayField ?? null,
      parsed.fields.map(toField),
    );
  }

  requestBody(): {
    name: string;
    description: string;
    displayField: string | null;
    fields: readonly ModelField[];
  } {
    return {
      name: this.name,
      description: this.description,
      displayField: this.displayField,
      fields: this.fields,
    };
  }

  /** The request body that saves this model over a live type without losing what the format cannot express. */
  requestBodyKeeping(live: LiveContentType | null): Record<string, unknown> {
    if (live === null) {
      return { ...this.requestBody() };
    }

    return {
      ...live.kept.type,
      ...this.requestBody(),
      fields: this.fields.map((field) => {
        const kept = live.kept.fields.get(field.id);

        return {
          ...kept?.field,
          ...field,
          ...(field.items === undefined ? {} : { items: { ...kept?.items, ...field.items } }),
        };
      }),
    };
  }

  serialize(): string {
    return `${render(this.requestBody(), 0, 0, 0)}\n`;
  }

  fieldIds(): string[] {
    return this.fields.map((field) => field.id);
  }

  dateFieldIds(): string[] {
    return this.fields.filter((field) => field.type === "Date").map((field) => field.id);
  }

  linkedTypes(): string[] {
    const validations = this.fields.flatMap((field) => [
      ...field.validations,
      ...(field.items?.validations ?? []),
    ]);
    const linked = validations.flatMap((validation) => {
      const ids = validation.linkContentType;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    });
    return [...new Set(linked)];
  }

  diff(live: ContentModel): ModelDiff {
    const liveById = new Map(live.fields.map((field) => [field.id, field]));
    const fileIds = new Set(this.fieldIds());

    const added = this.fieldIds().filter((id) => !liveById.has(id));
    const removed = live.fieldIds().filter((id) => !fileIds.has(id));

    const changed = this.fields.flatMap((field) => {
      const counterpart = liveById.get(field.id);
      if (!counterpart) return [];
      const changes = fieldChanges(field, counterpart);
      return changes.length > 0 ? [{ id: field.id, changes }] : [];
    });

    const shared = (ids: string[]) => ids.filter((id) => fileIds.has(id) && liveById.has(id));
    const reordered = !isDeepStrictEqual(shared(this.fieldIds()), shared(live.fieldIds()));

    const properties = [
      { property: "name", file: this.name, live: live.name },
      { property: "description", file: this.description, live: live.description },
    ].filter((change) => change.file !== change.live);
    const displayField = {
      file: this.displayField,
      live: live.displayField,
      differs: this.displayField !== live.displayField,
    };

    return {
      identical:
        properties.length === 0 &&
        !displayField.differs &&
        added.length === 0 &&
        removed.length === 0 &&
        changed.length === 0 &&
        !reordered,
      properties,
      displayField,
      added,
      removed,
      changed,
      reordered,
    };
  }
}
