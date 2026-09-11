"use client";

import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "./button";

export { ThemeProvider } from "next-themes";

/**
 * One click flips the effective theme. `system` stays the provider default for a
 * first visit, but it is not offered as a third state: the button reads
 * `resolvedTheme` and writes its opposite explicitly.
 *
 * The icons swap through `dark:` variants rather than state so the server and
 * the first client render agree; only the accessible name waits for mount,
 * since `resolvedTheme` is undefined until next-themes has read the document.
 */
interface ThemeToggleLabels {
  toggle?: string;
  switchToLight?: string;
  switchToDark?: string;
}

export function ThemeToggle({
  className,
  labels,
  showLabel = false,
}: {
  className?: string;
  labels?: ThemeToggleLabels;
  /** Show the action label when the control needs to be discoverable without icon recognition. */
  showLabel?: boolean;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const actionLabel = !mounted
    ? (labels?.toggle ?? "Toggle theme")
    : isDark
      ? (labels?.switchToLight ?? "Switch to light mode")
      : (labels?.switchToDark ?? "Switch to dark mode");

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon-sm"}
      className={className}
      aria-label={actionLabel}
      title={showLabel ? undefined : actionLabel}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span aria-hidden="true" className="relative size-[18px] shrink-0">
        <SunIcon className="absolute inset-0 size-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <MoonIcon className="absolute inset-0 size-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </span>
      {showLabel ? <span className="truncate">{labels?.toggle ?? "Toggle theme"}</span> : null}
    </Button>
  );
}
