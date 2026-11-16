"use client";

import type { DatasetFile, DatasetFileKind } from "@repo/api/domains/dataset/dataset.schema";
import { zDatasetFileKind } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { DatasetFileGroup } from "./dataset-file-group";

/** The frozen files, one row per kind in a fixed order, the standard packages after the data. */
export function DatasetFiles({ files }: { files: DatasetFile[] }) {
  const { t } = useTranslation("datasets");

  const filesOf = (kind: DatasetFileKind) => files.filter((file) => file.kind === kind);
  const kinds = zDatasetFileKind.options.filter((kind) => filesOf(kind).length > 0);

  const renderKind = (kind: DatasetFileKind) => (
    <DatasetFileGroup key={kind} kind={kind} files={filesOf(kind)} />
  );

  return (
    <section className="space-y-2" id="dataset-files" data-testid="dataset-files">
      <h2 className="text-lg font-semibold">{t("page.files")}</h2>
      <ul className="bg-card divide-border divide-y rounded-lg border">{kinds.map(renderKind)}</ul>
    </section>
  );
}
