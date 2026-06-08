"use client";

import { NOTIFICATION_BELL_TOGGLE_EVENT } from "@/components/navigation/navigation-topbar/activity-popover";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useToast } from "@repo/ui/hooks/use-toast";

const G_MODE_TIMEOUT_MS = 1500;
const COMMAND_PALETTE_OPEN_EVENT = "openjii:open-command-palette";
const CHEATSHEET_OPEN_EVENT = "openjii:open-cheatsheet";

function isInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// `C` create — map the current section to its create route. Returns null where
// there is nothing to create (no-op rather than a dead navigation).
function createPathFor(pathname: string, locale: string): string | null {
  // Match the section segment exactly so e.g. `experiments-archive` (read-only)
  // doesn't get treated as `experiments`.
  const segments = pathname.split("/").filter(Boolean);
  const platformIdx = segments.indexOf("platform");
  const section = platformIdx >= 0 ? segments[platformIdx + 1] : undefined;
  if (!section || segments[segments.length - 1] === "new") return null;
  const base = `/${locale}/platform`;
  if (section === "experiments") return `${base}/experiments/new`;
  if (section === "protocols") return `${base}/protocols/new`;
  if (section === "macros") return `${base}/macros/new`;
  return null;
}

// `/` focus — the page's inline search box, if it has one.
function focusInlineSearch(): boolean {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="search"], input[placeholder*="earch"]',
  );
  if (!input) return false;
  input.focus();
  return true;
}

interface GoToShortcut {
  key: string;
  label: string;
  path?: string;
  action?: () => void;
}

export function ShortcutsRoot({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  const gModeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inGMode = React.useRef(false);
  const gModeToastId = React.useRef<string | null>(null);

  const goToShortcuts: GoToShortcut[] = React.useMemo(
    () => [
      { key: "h", label: "Home", path: `/${locale}/platform` },
      { key: "e", label: "Experiments", path: `/${locale}/platform/experiments` },
      { key: "w", label: "Workbooks", path: `/${locale}/platform/workbooks` },
      { key: "p", label: "Protocols", path: `/${locale}/platform/protocols` },
      { key: "m", label: "Macros", path: `/${locale}/platform/macros` },
      { key: "t", label: "Transfer requests", path: `/${locale}/platform/transfer-request` },
      { key: "s", label: "Settings", path: `/${locale}/platform/account/settings` },
      {
        key: "n",
        label: "Notifications",
        action: () => window.dispatchEvent(new Event(NOTIFICATION_BELL_TOGGLE_EVENT)),
      },
      {
        key: "a",
        label: "Account",
        path: `/${locale}/platform/account/settings`,
      },
    ],
    [locale],
  );

  const exitGMode = React.useCallback(() => {
    inGMode.current = false;
    if (gModeTimer.current) {
      clearTimeout(gModeTimer.current);
      gModeTimer.current = null;
    }
    if (gModeToastId.current) {
      dismiss(gModeToastId.current);
      gModeToastId.current = null;
    }
  }, [dismiss]);

  const enterGMode = React.useCallback(() => {
    inGMode.current = true;
    const t = toast({
      title: "Go to…",
      description: "Press a letter to navigate (Esc to cancel)",
      duration: G_MODE_TIMEOUT_MS,
    });
    gModeToastId.current = t.id;
    if (gModeTimer.current) clearTimeout(gModeTimer.current);
    gModeTimer.current = setTimeout(() => {
      exitGMode();
    }, G_MODE_TIMEOUT_MS);
  }, [toast, exitGMode]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Modifier combos: ⌘K opens palette. ⌘B is already handled by SidebarProvider.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
        return;
      }

      // Don't fire single-key shortcuts while typing.
      if (isInputTarget(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      // If we're in g-mode, the next key is the target.
      if (inGMode.current) {
        const match = goToShortcuts.find((s) => s.key === event.key.toLowerCase());
        exitGMode();
        if (match) {
          event.preventDefault();
          if (match.path) router.push(match.path);
          else match.action?.();
        }
        return;
      }

      if (event.key === "g") {
        event.preventDefault();
        enterGMode();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        window.dispatchEvent(new Event(CHEATSHEET_OPEN_EVENT));
        return;
      }

      // C — create new, route-aware.
      if (event.key === "c") {
        const createPath = createPathFor(pathname, locale);
        if (createPath) {
          event.preventDefault();
          router.push(createPath);
        }
        return;
      }

      // / — focus the page's inline search, if present.
      if (event.key === "/") {
        if (focusInlineSearch()) event.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterGMode, exitGMode, goToShortcuts, router, pathname, locale]);

  // Clear any pending g-mode timer/toast when the component unmounts.
  React.useEffect(() => () => exitGMode(), [exitGMode]);

  return null;
}

export { COMMAND_PALETTE_OPEN_EVENT, CHEATSHEET_OPEN_EVENT };
