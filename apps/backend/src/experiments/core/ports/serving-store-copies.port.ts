import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../models/experiment-data-annotation.model";
import type { CopyKey } from "../models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";

export const SERVING_STORE_COPIES_PORT = Symbol("SERVING_STORE_COPIES_PORT");

/** The serving store's copies of annotations and metadata sheets, which the outbox keeps current. */
export interface ServingStoreCopiesPort {
  /** False where the environment has no store or no copier, so no copy is owed to it. */
  isConfigured(): boolean;

  writeAnnotations(annotations: AnnotationCopy[]): Promise<Result<void>>;

  removeAnnotations(gone: CopyKey[]): Promise<Result<void>>;

  /** Writes each sheet's rows and removes the rows an edit took out of it. */
  writeSheets(sheets: MetadataSheetRecord[]): Promise<Result<void>>;

  removeSheets(gone: CopyKey[]): Promise<Result<void>>;
}
