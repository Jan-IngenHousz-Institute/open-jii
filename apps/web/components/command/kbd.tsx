"use client";

import { modifierLabel } from "@/lib/platform";
import * as React from "react";
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

/**
 * `useModifierKey` is client-only — render the fallback (⌘) during SSR so the
 * markup matches the server tree, then swap in "Ctrl" after hydration on
 * non-Mac platforms.
 */
function useModifierKey() {
  const [mod, setMod] = React.useState<string>("⌘");
  React.useEffect(() => {
    setMod(modifierLabel());
  }, []);
  return mod;
}

export function CommandKHint({ className }: { className?: string }) {
  const mod = useModifierKey();
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <Kbd>{mod}</Kbd>
      <Kbd>K</Kbd>
    </span>
  );
}
