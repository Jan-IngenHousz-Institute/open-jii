"use client";

import { AlertCircle, Check, CheckCircle2, Copy, Play } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, Badge, Button, ScrollArea } from "@repo/ui/components";

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
    <div className="flex-1 space-y-2">
      <h3 className="text-sm font-medium">{t("iot.protocolTester.results")}</h3>
      {testResult ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="text-sm font-medium">
                  {testResult.success
                    ? t("iot.protocolTester.success")
                    : t("iot.protocolTester.failed")}
                </div>
                <div className="text-muted-foreground text-xs">
                  {testResult.timestamp.toLocaleTimeString()} • {testResult.executionTime}ms
                </div>
              </div>
            </div>
            <Badge
              variant={testResult.success ? "default" : "destructive"}
              className={testResult.success ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {testResult.success ? t("iot.protocolTester.passed") : t("iot.protocolTester.error")}
            </Badge>
          </div>

          {testResult.success ? (
            <div className="space-y-2">
              <div className="text-xs font-medium">{t("iot.protocolTester.responseData")}</div>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-background hover:bg-accent absolute right-2 top-2 z-10 h-7 border px-2 shadow-sm"
                  onClick={handleCopy}
                  title={tCommon("common.copy")}
                >
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">{tCommon("common.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      <span className="text-xs">{tCommon("common.copy")}</span>
                    </>
                  )}
                </Button>
                <ScrollArea className="bg-muted/30 h-[500px] rounded border">
                  <pre className="p-4 text-xs">{JSON.stringify(testResult.data, null, 2)}</pre>
                </ScrollArea>
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
        <div className="bg-muted/20 flex h-[500px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <Play className="text-muted-foreground/20 mx-auto mb-2 h-8 w-8" />
            <div className="text-muted-foreground text-sm">
              {t("iot.protocolTester.noResultsYet")}
            </div>
            <div className="text-muted-foreground text-xs">
              {t("iot.protocolTester.runProtocolToSeeResults")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
