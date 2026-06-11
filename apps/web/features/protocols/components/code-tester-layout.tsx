"use client";

import { MonitorX } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/resizable";
import { useBreakpoint } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";

interface CodeTesterLayoutProps {
  /** Content rendered in the left (code editor) panel */
  codePanel: React.ReactNode;
  /** Content rendered inside the right (tester) panel body */
  testerPanel: React.ReactNode;
  /** Title shown in the tester panel header */
  testerTitle: string;
  /** Browser support flags — controls panel sizing and "not supported" fallback */
  browserSupport: { bluetooth: boolean; serial: boolean; any: boolean };
  /** Default size of the tester panel when browser is supported (default: 45) */
  testerDefaultSize?: number;
  /** Optional className for the outer container */
  className?: string;
}

export function CodeTesterLayout({
  codePanel,
  testerPanel,
  testerTitle,
  browserSupport,
  testerDefaultSize: testerDefaultSizeProp = 45,
  className,
}: CodeTesterLayoutProps) {
  const { t: tIot } = useTranslation("iot");
  const { isMobile, isTablet, isLgTablet } = useBreakpoint();

  const codeDefaultSize = browserSupport.any ? 100 - testerDefaultSizeProp : 85;
  const codeMinSize = isTablet ? 40 : 30;
  const testerDefaultSize = browserSupport.any ? testerDefaultSizeProp : 15;
  const testerMinSize = browserSupport.any ? (isTablet ? 50 : isLgTablet ? 40 : 20) : 10;

  const testerHeader = (
    <div className="flex w-full items-center border-b px-2.5 py-2.5 sm:px-4">
      <span className="text-sm font-medium">{testerTitle}</span>
    </div>
  );

  const testerContent = browserSupport.any ? (
    testerPanel
  ) : (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <MonitorX className="text-muted-foreground mx-auto mb-2 h-6 w-6" />
        <div className="text-muted-foreground text-xs">
          {tIot("iot.protocolRunner.browserNotSupported")}
        </div>
        <div className="text-muted-foreground/60 text-xs">
          {tIot("iot.protocolRunner.tryDifferentBrowser")}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className={cn("flex flex-1 flex-col gap-4 overflow-auto", className)}>
        <div className="min-h-[300px] rounded-lg border">
          <div className="h-full">{codePanel}</div>
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-lg border",
            !browserSupport.any && "bg-muted/30",
          )}
        >
          {testerHeader}
          <div className="flex flex-1 flex-col overflow-y-auto p-2.5">{testerContent}</div>
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className={cn("flex-1 rounded-lg border", className)}
    >
      <ResizablePanel defaultSize={codeDefaultSize} minSize={codeMinSize}>
        <div className="h-full min-h-[200px]">{codePanel}</div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={testerDefaultSize} minSize={testerMinSize}>
        <div
          className={cn(
            "flex h-full min-w-0 flex-col overflow-hidden",
            !browserSupport.any && "bg-muted/30",
          )}
        >
          {testerHeader}
          <div className="flex flex-1 flex-col overflow-y-auto p-2.5 sm:p-4">{testerContent}</div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
