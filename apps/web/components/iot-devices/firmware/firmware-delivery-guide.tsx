"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { BookOpen, Check, ChevronDown, Copy } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

const JOB_DOCUMENT_EXAMPLE = `{
  "operation": "firmware-update",
  "family": "ambyte",
  "version": "v1.3.0",
  "sha256": "<hex digest of the image>",
  "url": "<short-lived presigned download URL>"
}`;

const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;

/**
 * How an update actually reaches a device. Rollouts are started by JII from a
 * reviewed workflow, never from this page, so this panel documents rather than
 * offers controls.
 */
export function FirmwareDeliveryGuide() {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const { copy, copied } = useCopyToClipboard();

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
        <BookOpen className="h-4 w-4" aria-hidden />
        {t("iot.devices.firmware.guide.title")}
        <ChevronDown className="text-muted-foreground ml-auto h-4 w-4" aria-hidden />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 px-3 pb-3">
        <p className="text-muted-foreground text-xs">{t("iot.devices.firmware.guide.intro")}</p>

        <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
          {STEP_KEYS.map((step) => (
            <li key={step}>{t(`iot.devices.firmware.guide.${step}`)}</li>
          ))}
        </ol>

        <div className="relative">
          <pre className="bg-muted/30 whitespace-pre-wrap break-words rounded border p-3 pr-20 text-xs">
            {JOB_DOCUMENT_EXAMPLE}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-background hover:bg-accent shadow-xs absolute right-2 top-2 h-7 w-7 border"
            aria-label={copied ? tCommon("common.copied") : tCommon("common.copy")}
            title={copied ? tCommon("common.copied") : tCommon("common.copy")}
            onClick={() => copy(JOB_DOCUMENT_EXAMPLE)}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <DocsHelpLink path="/developers/device-integration" />
      </CollapsibleContent>
    </Collapsible>
  );
}
