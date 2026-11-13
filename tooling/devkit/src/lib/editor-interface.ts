import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { parseWith } from "./content-model.js";

export interface Control {
  fieldId: string;
  widgetNamespace?: string;
  widgetId?: string;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

const controlSchema = z.looseObject({
  fieldId: z.string(),
  widgetNamespace: z.string().optional(),
  widgetId: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const editorInterfaceSchema = z.looseObject({
  sys: z.looseObject({ version: z.number().int().optional() }),
  controls: z.array(controlSchema).default([]),
});

export const dateWidgetSettings = { format: "timeZ", ampm: "24" };

export function dateControl(fieldId: string, existing?: Control): Control {
  const helpText = existing?.settings?.helpText;
  const kept = existing?.widgetId === "datePicker" ? existing.settings : undefined;

  return {
    ...existing,
    fieldId,
    widgetNamespace: "builtin",
    widgetId: "datePicker",
    settings: { ...(helpText === undefined ? {} : { helpText }), ...kept, ...dateWidgetSettings },
  };
}

export class EditorInterface {
  constructor(
    readonly version: number | null,
    readonly controls: readonly Control[],
    private readonly rest: Record<string, unknown>,
  ) {}

  static fromResponse(value: unknown, label: string): EditorInterface {
    const { sys, controls, ...rest } = parseWith(editorInterfaceSchema, value, label);
    return new EditorInterface(sys.version ?? null, controls, rest);
  }

  withDateControls(fieldIds: readonly string[]): EditorInterface {
    const handled = new Set<string>();
    const replaced = this.controls.map((control) => {
      if (!fieldIds.includes(control.fieldId)) return control;
      handled.add(control.fieldId);
      return dateControl(control.fieldId, control);
    });
    const appended = fieldIds.filter((id) => !handled.has(id)).map((id) => dateControl(id));

    return new EditorInterface(this.version, [...replaced, ...appended], this.rest);
  }

  /** The given Date fields whose control `withDateControls` would change. */
  fieldsWithoutDateControl(fieldIds: readonly string[]): string[] {
    return fieldIds.filter((id) => {
      const control = this.controls.find((entry) => entry.fieldId === id);
      return control === undefined || !isDeepStrictEqual(control, dateControl(id, control));
    });
  }

  equals(other: EditorInterface): boolean {
    return isDeepStrictEqual(this.controls, other.controls);
  }

  requestBody(): Record<string, unknown> {
    return { ...this.rest, controls: this.controls };
  }
}
