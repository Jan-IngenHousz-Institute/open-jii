"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
import { JsonFormatToggle } from "@/components/shared/json-format-toggle";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useJsonFormatStyle } from "@/hooks/useJsonFormatStyle";
import { formatJson } from "@/lib/json-format";
import { AlertCircle, Check, CheckCircle2, Copy, Play } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

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
  const { copy: copyToClipboard, copied } = useCopyToClipboard();
  const { style, toggleStyle } = useJsonFormatStyle();
  // Device responses carry long sample arrays; copy takes what is on screen.
  const responseJson = useMemo(
    () => formatJson(testResult?.data, { style }),
    [testResult?.data, style],
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (testResult?.data === undefined) return;
    await copyToClipboard(responseJson);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <h3 className="shrink-0 text-sm font-medium">{t("iot.protocolRunner.results")}</h3>
      {testResult ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="text-status-active-foreground h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
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
            <StatusBadge tone={testResult.success ? "active" : "destructive"} className="shrink-0">
              {testResult.success ? t("iot.protocolRunner.passed") : t("iot.protocolRunner.error")}
            </StatusBadge>
          </div>

          {testResult.success ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="shrink-0 text-xs font-medium">
                {t("iot.protocolRunner.responseData")}
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                  <JsonFormatToggle style={style} onToggle={toggleStyle} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-background hover:bg-accent shadow-xs h-7 w-7 border"
                    onClick={handleCopy}
                    aria-label={copied ? tCommon("common.copied") : tCommon("common.copy")}
                    title={copied ? tCommon("common.copied") : tCommon("common.copy")}
                  >
                    {copied ? (
                      <Check className="text-status-active-foreground h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted/30 min-h-[12rem] flex-1 overflow-auto rounded border">
                  <pre className="whitespace-pre-wrap break-words p-3 pr-20 text-xs">
                    {responseJson}
                  </pre>
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
        <InsetPanel
          dashed
          padding="none"
          className="flex min-h-24 flex-1 items-center justify-center"
        >
          <div className="text-center">
            <Play className="text-muted-foreground/20 mx-auto mb-1.5 h-6 w-6" />
            <div className="text-muted-foreground text-xs">
              {t("iot.protocolRunner.noResultsYet")}
            </div>
            <div className="text-muted-foreground/60 text-xs">
              {t("iot.protocolRunner.runProtocolToSeeResults")}
            </div>
          </div>
        </InsetPanel>
      )}
    </div>
  );
}
