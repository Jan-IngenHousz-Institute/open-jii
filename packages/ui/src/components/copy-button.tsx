"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

interface CopyButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  /** The text placed on the clipboard. */
  value: string;
  /** Announced and shown on hover; also the copied-state label's stem. */
  label: string;
  copiedLabel: string;
  /** How long the confirmed state holds before reverting. */
  resetDelay?: number;
}

/**
 * Copy affordance for the values users are expected to move by hand: thing
 * names, endpoints, topic prefixes. Self-contained rather than built on the
 * app's `useCopyToClipboard`, because a package cannot import from the app;
 * that hook stays for non-button call sites.
 */
const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    { value, label, copiedLabel, resetDelay = 2000, className, variant = "ghost", size, ...props },
    ref,
  ) => {
    const [copied, setCopied] = React.useState(false);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(
      () => () => {
        if (timer.current !== null) {
          clearTimeout(timer.current);
        }
      },
      [],
    );

    async function copy() {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // A blocked clipboard is not worth an error surface; the value is
        // visible and selectable either way.
        return;
      }

      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), resetDelay);
    }

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size ?? "icon"}
        aria-label={copied ? copiedLabel : label}
        title={copied ? copiedLabel : label}
        className={cn("size-6", className)}
        onClick={() => void copy()}
        {...props}
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>
    );
  },
);
CopyButton.displayName = "CopyButton";

export { CopyButton };
