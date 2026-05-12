"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface KbdProps extends ComponentPropsWithoutRef<"kbd"> {
  children: ReactNode;
}

export function Kbd({ className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 font-mono text-[11px] font-medium text-muted-foreground",
        "bg-[hsl(180_12%_92%)] dark:bg-[hsl(180_15%_18%)]",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

interface KbdSequenceProps {
  keys: string[];
  className?: string;
}

export function KbdSequence({ keys, className }: KbdSequenceProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${i}`}>{key}</Kbd>
      ))}
    </span>
  );
}

export function CommandKHint({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </span>
  );
}
