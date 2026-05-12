"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

import { useWhatsNew } from "./whats-new-context";

interface WhatsNewFooterItemProps {
  label: string;
  className?: string;
}

export function WhatsNewFooterItem({ label, className }: WhatsNewFooterItemProps) {
  const { setOpen, unreadCount } = useWhatsNew();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={
        unreadCount > 0 ? `${label} (${unreadCount} unread updates)` : label
      }
      className={cn(
        "group/whats-new flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-[hsl(136_74%_58%)]"
        />
      )}
    </button>
  );
}
