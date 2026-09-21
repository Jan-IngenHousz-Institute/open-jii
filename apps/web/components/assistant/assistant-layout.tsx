"use client";

import { useAssistant } from "@/components/assistant/assistant-context";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { SidebarInset } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";

export function AssistantLayout({ children, locale }: { children: ReactNode; locale: string }) {
  const { enabled, open, setOpen } = useAssistant();
  const { t } = useTranslation("assistant");

  return (
    <div className="bg-sidebar flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
      <div className={cn("flex min-h-0 flex-1 gap-2 px-2 pt-2 md:pl-0", !enabled && "pb-2")}>
        <SidebarInset
          className={cn(
            "platform-content-container ring-border/30 h-full overflow-hidden rounded-lg shadow-sm ring-1",
            open && "hidden md:flex",
          )}
        >
          {children}
        </SidebarInset>
        <AssistantPanel locale={locale} />
      </div>
      {enabled && (
        <footer className="bg-sidebar text-sidebar-foreground flex h-7 shrink-0 items-center justify-end px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded px-2 text-xs"
            aria-label={open ? t("close") : t("open")}
            aria-expanded={open}
            aria-controls="assistant-panel"
            onClick={() => setOpen(!open)}
          >
            <Sparkles className="size-3.5" aria-hidden />
            AI
          </Button>
        </footer>
      )}
    </div>
  );
}
