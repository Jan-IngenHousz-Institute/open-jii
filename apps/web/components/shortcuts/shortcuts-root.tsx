"use client";

import { NOTIFICATION_BELL_TOGGLE_EVENT } from "@/components/navigation/navigation-topbar/activity-popover";
import { useWhatsNew } from "@/components/whats-new/whats-new-context";
import { useRouter } from "next/navigation";
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

interface GoToShortcut {
  key: string;
  label: string;
  path?: string;
  action?: () => void;
}

export function ShortcutsRoot({ locale }: { locale: string }) {
  const router = useRouter();
  const { setOpen: setWhatsNewOpen } = useWhatsNew();
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
        key: "r",
        label: "What's new",
        action: () => setWhatsNewOpen(true),
      },
      {
        key: "n",
        label: "Notifications",
        action: () =>
          window.dispatchEvent(new Event(NOTIFICATION_BELL_TOGGLE_EVENT)),
      },
      {
        key: "a",
        label: "Account / activity",
        path: `/${locale}/platform/account/settings`,
      },
    ],
    [locale, setWhatsNewOpen],
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

      if (event.key === "Escape") {
        if (inGMode.current) {
          exitGMode();
          event.preventDefault();
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
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterGMode, exitGMode, goToShortcuts, router]);

  return null;
}

export { COMMAND_PALETTE_OPEN_EVENT, CHEATSHEET_OPEN_EVENT };
