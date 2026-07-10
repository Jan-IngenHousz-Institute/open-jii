"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Check, Copy, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface IotCredentialFileProps {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  filename: string;
  content: string;
  copyable?: boolean;
}

export function IotCredentialFile({
  icon: Icon,
  label,
  sublabel,
  filename,
  content,
  copyable = false,
}: IotCredentialFileProps) {
  const { t } = useTranslation("iot");
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F6F8FA] text-[#68737B]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#011111]">{label}</p>
        <p className="text-muted-foreground truncate text-xs">{sublabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {copyable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t("iot.devices.credentials.copy")}
            aria-label={t("iot.devices.credentials.copy")}
            onClick={() => copy(content)}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadText(filename, content)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t("iot.devices.credentials.download")}
        </Button>
      </div>
    </div>
  );
}
