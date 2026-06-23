"use client";

import { NOTIFICATION_BELL_OPEN_EVENT } from "@/components/navigation/navigation-topbar/activity-popover";
import { modifierLabel } from "@/lib/platform";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import type { Hotkey } from "@tanstack/react-hotkeys";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useSidebar } from "@repo/ui/components/sidebar";

import { isEditableTarget } from "./is-editable-target";
import { showShortcutHint } from "./use-shortcut-hint";

const G_MODE_TIMEOUT_MS = 1500;
const COMMAND_PALETTE_OPEN_EVENT = "openjii:open-command-palette";
const CHEATSHEET_OPEN_EVENT = "openjii:open-cheatsheet";

// Single-key shortcuts manage preventDefault themselves: the handler bails when
// focus is in a field/widget (TanStack's tag-only `ignoreInputs` misses ARIA
// widgets), and only swallows the key when it actually acts. Default options
// would preventDefault/stopPropagation on match — before our guard runs.
const GUARD_OPTS = { preventDefault: false, stopPropagation: false } as const;

// True when the page shortcut should be ignored because focus is in an
// editable field/widget. Checks both the focused element and the event target.
function blockedByFocus(event: KeyboardEvent): boolean {
  return isEditableTarget(document.activeElement) || isEditableTarget(event.target);
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
  key: Hotkey;
  label: string;
  path?: string;
  action?: () => void;
}

// One `G` then <key> sequence. A component (not a loop) so the hook count stays
// stable across renders.
function GoToSequence({
  shortcut,
  onNavigate,
}: {
  shortcut: GoToShortcut;
  onNavigate: (shortcut: GoToShortcut) => void;
}) {
  useHotkeySequence(
    ["G", shortcut.key],
    (event) => {
      if (blockedByFocus(event)) return;
      event.preventDefault();
      onNavigate(shortcut);
    },
    { ...GUARD_OPTS, timeout: G_MODE_TIMEOUT_MS },
  );
  return null;
}

export function ShortcutsRoot({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const goToShortcuts = React.useMemo<GoToShortcut[]>(
    () => [
      { key: "H", label: "Home", path: `/${locale}/platform` },
      { key: "E", label: "Experiments", path: `/${locale}/platform/experiments` },
      { key: "W", label: "Workbooks", path: `/${locale}/platform/workbooks` },
      { key: "P", label: "Protocols", path: `/${locale}/platform/protocols` },
      { key: "M", label: "Macros", path: `/${locale}/platform/macros` },
      { key: "T", label: "Transfer requests", path: `/${locale}/platform/transfer-request` },
      { key: "S", label: "Settings", path: `/${locale}/platform/account` },
      {
        key: "N",
        label: "Notifications",
        action: () => window.dispatchEvent(new Event(NOTIFICATION_BELL_OPEN_EVENT)),
      },
      { key: "A", label: "Account", path: `/${locale}/platform/account` },
    ],
    [locale],
  );

  const navigate = React.useCallback(
    (shortcut: GoToShortcut) => {
      if (shortcut.path) router.push(shortcut.path);
      else shortcut.action?.();
      showShortcutHint({ keys: ["G", String(shortcut.key)], label: shortcut.label });
    },
    [router],
  );

  // ⌘/Ctrl combos fire in inputs too (TanStack default for Mod), so no focus guard.
  useHotkey(
    "Mod+K",
    () => {
      window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
      showShortcutHint({ keys: [modifierLabel(), "K"], label: "Command palette" });
    },
    { preventDefault: true },
  );

  useHotkey(
    "Mod+B",
    () => {
      toggleSidebar();
      showShortcutHint({ keys: [modifierLabel(), "B"], label: "Toggle sidebar" });
    },
    { preventDefault: true },
  );

  // `G` arms the go-to sequences; surface the hint so the user knows to follow up.
  useHotkey(
    "G",
    (event) => {
      if (blockedByFocus(event)) return;
      showShortcutHint({ keys: ["G", "…"], label: "Go to…" });
    },
    GUARD_OPTS,
  );

  // `?` is Shift+/ — bind by raw key since it isn't in the typed Hotkey union.
  useHotkey(
    { key: "?", shift: true },
    (event) => {
      if (blockedByFocus(event)) return;
      event.preventDefault();
      // Opening the sheet is its own feedback — and emitting a hint here would
      // immediately trip the sheet's dismiss-on-shortcut watcher.
      window.dispatchEvent(new Event(CHEATSHEET_OPEN_EVENT));
    },
    GUARD_OPTS,
  );

  useHotkey(
    "C",
    (event) => {
      if (blockedByFocus(event)) return;
      const createPath = createPathFor(pathname, locale);
      if (!createPath) return;
      event.preventDefault();
      router.push(createPath);
      showShortcutHint({ keys: ["C"], label: "Create" });
    },
    GUARD_OPTS,
  );

  useHotkey(
    "/",
    (event) => {
      if (blockedByFocus(event)) return;
      if (focusInlineSearch()) {
        event.preventDefault();
        showShortcutHint({ keys: ["/"], label: "Search" });
      }
    },
    GUARD_OPTS,
  );

  return (
    <>
      {goToShortcuts.map((shortcut) => (
        <GoToSequence key={String(shortcut.key)} shortcut={shortcut} onNavigate={navigate} />
      ))}
    </>
  );
}

export { COMMAND_PALETTE_OPEN_EVENT, CHEATSHEET_OPEN_EVENT };
