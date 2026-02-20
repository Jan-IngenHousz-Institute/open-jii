"use client";

import { AlertCircle, Check, CheckCircle2, Copy, Play } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, Badge, Button } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

interface ProtocolResultsDisplayProps {
  testResult: TestResult | null;
}

export function ProtocolResultsDisplay({ testResult }: ProtocolResultsDisplayProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!testResult?.data) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(testResult.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <h3 className="shrink-0 text-sm font-medium">{t("iot.protocolRunner.results")}</h3>
      {testResult ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {testResult.success
                    ? t("iot.protocolRunner.success")
                    : t("iot.protocolRunner.failed")}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {testResult.timestamp.toLocaleTimeString()} • {testResult.executionTime}ms
                </div>
              </div>
            </div>
            <Badge
              variant={testResult.success ? "default" : "destructive"}
              className={cn(
                "shrink-0",
                testResult.success ? "bg-green-600 hover:bg-green-700" : "",
              )}
            >
              {testResult.success ? t("iot.protocolRunner.passed") : t("iot.protocolRunner.error")}
            </Badge>
          </div>

          {testResult.success ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="shrink-0 text-xs font-medium">
                {t("iot.protocolRunner.responseData")}
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-background hover:bg-accent absolute right-2 top-2 z-10 h-7 w-7 border shadow-sm"
                  onClick={handleCopy}
                  aria-label={copied ? tCommon("common.copied") : tCommon("common.copy")}
                  title={copied ? tCommon("common.copied") : tCommon("common.copy")}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <div className="bg-muted/30 min-h-[12rem] flex-1 overflow-auto rounded border">
                  <pre className="p-3 text-xs">{JSON.stringify(testResult.data, null, 2)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{testResult.error}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="bg-muted/20 flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Play className="text-muted-foreground/20 mx-auto mb-1.5 h-6 w-6" />
            <div className="text-muted-foreground text-xs">
              {t("iot.protocolRunner.noResultsYet")}
            </div>
            <div className="text-muted-foreground/60 text-xs">
              {t("iot.protocolRunner.runProtocolToSeeResults")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
