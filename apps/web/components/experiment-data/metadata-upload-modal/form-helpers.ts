import type { MetadataRow } from "@/components/metadata-table/types";

import type {
  ExperimentCustomMetadataPayload,
  ExperimentMetadata,
} from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";

// Form values mirror the contract's `metadata` payload, with col_X column ids
// during editing. `zCustomMetadataPayload`'s `identifierColumnId` is checked
// against `column.id`, so the same schema validates both shapes.
export type MetadataFormValues = ExperimentCustomMetadataPayload;

export const EMPTY_FORM_VALUES: MetadataFormValues = {
  name: "",
  columns: [],
  rows: [],
  identifierColumnId: "",
  experimentQuestionId: "",
};

// Auto-generate "Untitled Metadata N" when the user didn't pick a name.
export function autoNameUntitled(name: string, existing: ExperimentMetadata[]): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  const untitledCount = existing.filter((r) => {
    const n = (r.metadata as { name?: string }).name ?? "";
    return /^Untitled Metadata(\s\d+)?$/.test(n);
  }).length;
  return untitledCount === 0 ? "Untitled Metadata" : `Untitled Metadata ${untitledCount + 1}`;
}

// Map the FE editing shape (col_X-keyed rows) to the on-wire payload shape
// (name-keyed rows), mirroring the contract validated by zCustomMetadataPayload.
export function toWirePayload(values: MetadataFormValues, existing: ExperimentMetadata[]) {
  const colIdToName = new Map(values.columns.map((c) => [c.id, c.name]));
  const savedRows: MetadataRow[] = values.rows.map((row) => {
    const mapped: MetadataRow = { _id: row._id };
    for (const [key, value] of Object.entries(row)) {
      if (key === "_id") continue;
      mapped[colIdToName.get(key) ?? key] = value;
    }
    return mapped;
  });
  const savedColumns = values.columns.map((c) => ({ ...c, id: c.name }));
  const savedIdentifierColumnId =
    colIdToName.get(values.identifierColumnId) ?? values.identifierColumnId;

  return {
    metadata: {
      name: autoNameUntitled(values.name, existing),
      columns: savedColumns,
      rows: savedRows,
      identifierColumnId: savedIdentifierColumnId,
      experimentQuestionId: values.experimentQuestionId,
    },
  };
}

export interface StoredMetadataShape {
  name?: string;
  columns?: MetadataFormValues["columns"];
  rows?: MetadataFormValues["rows"];
  identifierColumnId?: string;
  experimentQuestionId?: string;
}

export function asStoredMetadata(record: ExperimentMetadata): StoredMetadataShape {
  return record.metadata;
}
