"use client";

import { formatFileSize } from "@/util/format-file-size";
import { Download, FileText } from "lucide-react";

import type { DatasetFile } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function DatasetFiles({ files }: { files: DatasetFile[] }) {
  const { t } = useTranslation("datasets");

  const renderFile = (file: DatasetFile) => (
    <li key={file.name} className="flex items-center gap-3 px-4 py-3">
      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-muted-foreground text-xs">{t(`page.fileKinds.${file.kind}`)}</p>
      </div>
      <span className="text-muted-foreground text-sm tabular-nums">
        {formatFileSize(file.sizeBytes)}
      </span>
      <Button variant="outline" size="sm">
        <Download className="size-4" />
        {t("page.download")}
      </Button>
    </li>
  );

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{t("page.files")}</h2>
      <ul className="bg-card divide-border divide-y rounded-lg border">{files.map(renderFile)}</ul>
    </section>
  );
}
