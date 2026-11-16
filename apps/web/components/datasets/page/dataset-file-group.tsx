"use client";

import { formatList } from "@/components/calibrations/format-list";
import { useLocale } from "@/hooks/useLocale";
import { formatFileSize } from "@/util/format-file-size";
import { Download, FileText, ShieldCheck } from "lucide-react";

import type {
  DatasetFile,
  DatasetFileKind,
  PackageReport,
} from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface DatasetFileGroupProps {
  kind: DatasetFileKind;
  /** The same content in each format, such as CSV and Parquet. */
  files: DatasetFile[];
}

/** One kind of file: what it is, what a package says about itself, and a download per format. */
export function DatasetFileGroup({ kind, files }: DatasetFileGroupProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();

  const report = files.find((file) => file.report !== null)?.report ?? null;
  const hasPassedValidator = report?.type === "validated" && report.passed;

  const reportLine = (packageReport: PackageReport) => {
    if (packageReport.type === "conformsTo") {
      return t("page.conformsTo", { profiles: formatList(locale, packageReport.profiles) });
    }
    const verdict = packageReport.passed ? t("page.validatorPassed") : t("page.validatorFailed");
    const fields = t("page.fieldReport", {
      required: packageReport.required,
      filled: packageReport.filled,
      derived: packageReport.derived,
      missing: t("page.fieldsMissing", { count: packageReport.missing }),
    });
    return `${verdict} ${fields}`;
  };

  const renderDownload = (file: DatasetFile) => (
    <Button
      key={file.name}
      variant="outline"
      size="sm"
      aria-label={t("page.download", { name: file.name })}
    >
      <Download className="size-4" aria-hidden />
      {file.name}
      <span className="text-muted-foreground font-normal tabular-nums">
        {formatFileSize(file.sizeBytes)}
      </span>
    </Button>
  );

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3" data-testid={`dataset-file-${kind}`}>
      <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />

      <div className="min-w-48 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{t(`page.fileKinds.${kind}`)}</p>
        <p className="text-muted-foreground text-xs">{t(`page.fileDetails.${kind}`)}</p>
        {report !== null ? (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            {hasPassedValidator ? (
              <ShieldCheck
                className="text-status-active-foreground mt-px size-3.5 shrink-0"
                aria-hidden
              />
            ) : null}
            {reportLine(report)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">{files.map(renderDownload)}</div>
    </li>
  );
}
