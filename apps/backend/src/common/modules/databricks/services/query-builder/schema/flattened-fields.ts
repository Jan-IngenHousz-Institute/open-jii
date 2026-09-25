import { VariantSchema } from "./variant-schema";
import type { VariantField } from "./variant-schema";

/** A VARIANT column to flatten, and the suffix its fields take when their name is held. */
export interface FlattenedSource<Column extends string = string> {
  column: Column;
  schema: string;
  suffix: string;
}

/** One field of a flattened VARIANT column and the name it reads as. */
export interface FlattenedField<Column extends string = string> {
  key: string;
  column: Column;
  field: VariantField;
}

/**
 * Output names for the fields of flattened VARIANT columns. A field keeps its own name unless a
 * base column, a VARIANT read whole or an earlier field already holds it, compared without case
 * because Databricks resolves names that way. It then reads as `<name>_<suffix>`, numbered when
 * that is held too. Base columns never change name, and the same inputs always give the same
 * names, so the table, its filters and its export agree on every read.
 */
export class FlattenedFields {
  static resolve<Column extends string>(
    reserved: string[],
    sources: FlattenedSource<Column>[],
  ): FlattenedField<Column>[] {
    const wholeColumns = sources
      .filter(({ schema }) => !VariantSchema.isObject(schema))
      .map(({ column }) => column);
    const taken = new Set([...reserved, ...wholeColumns].map((name) => name.toLowerCase()));
    const fields = sources.flatMap(({ column, schema, suffix }) =>
      VariantSchema.topLevelFields(schema).map((field) => ({ column, field, suffix })),
    );

    // Every field that can keep its name claims it first, so a renamed field never takes the
    // name of one that did not clash.
    const kept = new Set<number>();
    fields.forEach(({ field }, index) => {
      const name = field.name.toLowerCase();
      if (!taken.has(name)) {
        taken.add(name);
        kept.add(index);
      }
    });

    return fields.map(({ column, field, suffix }, index) => {
      if (kept.has(index)) {
        return { key: field.name, column, field };
      }

      const key = FlattenedFields.freeName(field.name, suffix, taken);
      taken.add(key.toLowerCase());
      return { key, column, field };
    });
  }

  private static freeName(name: string, suffix: string, taken: Set<string>): string {
    const suffixed = `${name}_${suffix}`;
    let candidate = suffixed;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
      candidate = `${suffixed}_${n}`;
    }
    return candidate;
  }
}
