#!/usr/bin/env -S node --import tsx
/**
 * One-shot codemod for the feature/shared folder migration (OJD-1520).
 * Walks every .ts/.tsx file under apps/mobile/ and rewrites ~/ imports
 * to their new locations. Delete this file before merging the PR.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? ".";

// Rules in order. Each entry: [pattern: RegExp, replacement: string].
// Order matters - more specific paths must come BEFORE more general prefixes.
const RULES: Array<[RegExp, string]> = [
  // ---------- shared/db (must come before ~/services/) ----------
  [/~\/services\/db\//g, "~/shared/db/"],
  [/~\/services\/measurements-storage\b/g, "~/shared/db/measurements-storage"],
  [/~\/services\/prefetch-offline-data\b/g, "~/shared/db/prefetch-offline-data"],

  // ---------- features/auth (must come before ~/services/ and ~/hooks/) ----------
  [/~\/services\/auth\b/g, "~/features/auth/services/auth"],
  [/~\/hooks\/use-login\b/g, "~/features/auth/hooks/use-login"],
  [/~\/hooks\/use-session\b/g, "~/features/auth/hooks/use-session"],

  // ---------- features/measurement-flow ----------
  [/~\/hooks\/use-macro\b/g, "~/features/measurement-flow/hooks/use-macro"],
  [/~\/hooks\/use-protocols\b/g, "~/features/measurement-flow/hooks/use-protocols"],
  [/~\/hooks\/use-protocol\b/g, "~/features/measurement-flow/hooks/use-protocol"],
  [/~\/screens\/measurement-flow-screen/g, "~/features/measurement-flow/screens/measurement-flow-screen"],
  [/~\/components\/measurement-result/g, "~/features/measurement-flow/components/measurement-result"],
  [/~\/components\/python-macro-provider\b/g, "~/features/measurement-flow/components/python-macro-provider"],
  [/~\/stores\/use-measurement-flow-store\b/g, "~/features/measurement-flow/stores/use-measurement-flow-store"],
  [/~\/stores\/use-flow-answers-store\b/g, "~/features/measurement-flow/stores/use-flow-answers-store"],
  [/~\/stores\/use-macro-selection-store\b/g, "~/features/measurement-flow/stores/use-macro-selection-store"],
  [/~\/services\/python\//g, "~/features/measurement-flow/services/python/"],
  [/~\/services\/python\b/g, "~/features/measurement-flow/services/python"],
  [/~\/utils\/process-scan/g, "~/features/measurement-flow/utils/process-scan"],

  // ---------- features/recent-measurements ----------
  [/~\/hooks\/use-measurements\b/g, "~/features/recent-measurements/hooks/use-measurements"],
  [/~\/hooks\/use-all-measurements\b/g, "~/features/recent-measurements/hooks/use-all-measurements"],
  [/~\/hooks\/use-measurement-upload\b/g, "~/features/recent-measurements/hooks/use-measurement-upload"],
  [/~\/hooks\/use-questions-upload\b/g, "~/features/recent-measurements/hooks/use-questions-upload"],
  [/~\/hooks\/use-auto-upload\b/g, "~/features/recent-measurements/hooks/use-auto-upload"],
  [/~\/services\/export-measurements\b/g, "~/features/recent-measurements/services/export-measurements"],
  // recent-measurements-screen folder was flattened across hooks/screens/components:
  [/~\/components\/recent-measurements-screen\/recent-measurements-screen\b/g, "~/features/recent-measurements/screens/recent-measurements-screen"],
  [/~\/components\/recent-measurements-screen\/use-recent-measurements-actions\b/g, "~/features/recent-measurements/hooks/use-recent-measurements-actions"],
  [/~\/components\/recent-measurements-screen\//g, "~/features/recent-measurements/components/"],
  [/~\/components\/measurement-item\b/g, "~/features/recent-measurements/components/measurement-item"],
  [/~\/components\/recent-tab-icon\b/g, "~/features/recent-measurements/components/recent-tab-icon"],

  // ---------- features/experiments ----------
  [/~\/hooks\/use-experiments\b/g, "~/features/experiments/hooks/use-experiments"],
  [/~\/hooks\/use-experiment-flow-query\b/g, "~/features/experiments/hooks/use-experiment-flow-query"],
  [/~\/hooks\/use-experiment-measurements\b/g, "~/features/experiments/hooks/use-experiment-measurements"],
  [/~\/hooks\/use-precached-experiment-data\b/g, "~/features/experiments/hooks/use-precached-experiment-data"],
  [/~\/hooks\/use-experiment\b/g, "~/features/experiments/hooks/use-experiment"],
  [/~\/screens\/experiments-screen/g, "~/features/experiments/screens/experiments-screen"],
  [/~\/stores\/use-experiment-selection-store\b/g, "~/features/experiments/stores/use-experiment-selection-store"],
  [/~\/stores\/use-protocol-selection-store\b/g, "~/features/experiments/stores/use-protocol-selection-store"],

  // ---------- features/calibration ----------
  [/~\/screens\/calibration/g, "~/features/calibration/screens/calibration"],
  [/~\/protocols\/calibrations/g, "~/features/calibration/protocols/calibrations"],

  // ---------- features/connection ----------
  [/~\/services\/bluetooth-ble/g, "~/features/connection/services/bluetooth-ble"],
  [/~\/services\/device-connection-manager/g, "~/features/connection/services/device-connection-manager"],
  [/~\/services\/multispeq-communication/g, "~/features/connection/services/multispeq-communication"],
  [/~\/services\/mqtt/g, "~/features/connection/services/mqtt"],
  [/~\/services\/scan-manager/g, "~/features/connection/services/scan-manager"],
  [/~\/services\/request-bluetooth-permissions\b/g, "~/features/connection/services/request-bluetooth-permissions"],
  [/~\/components\/connection-setup/g, "~/features/connection/components/connection-setup"],
  [/~\/hooks\/use-devices\b/g, "~/features/connection/hooks/use-devices"],
  [/~\/hooks\/use-device-connection-store\b/g, "~/features/connection/hooks/use-device-connection-store"],
  [/~\/hooks\/use-auto-reconnect\b/g, "~/features/connection/hooks/use-auto-reconnect"],
  [/~\/stores\/use-scanner-command-executor-store\b/g, "~/features/connection/stores/use-scanner-command-executor-store"],
  [/~\/utils\/get-multispeq-mqtt-topic\b/g, "~/features/connection/utils/get-multispeq-mqtt-topic"],

  // ---------- features/profile ----------
  [/~\/hooks\/use-ota-update\b/g, "~/features/profile/hooks/use-ota-update"],
  [/~\/hooks\/use-is-development\b/g, "~/features/profile/hooks/use-is-development"],
  [/~\/widgets\/environment-selector\b/g, "~/features/profile/widgets/environment-selector"],

  // ---------- shared/ui ----------
  [/~\/components\/(AlertDialog|Button|Card|Checkbox|Dropdown|HtmlViewer|Input|OTPInput|TabBar)\b/g, "~/shared/ui/$1"],
  [/~\/components\/(big-action-button|json-viewer|large-spinner|error-view|result-view|configured-query-client-provider|time-sync-provider)\b/g, "~/shared/ui/$1"],
  [/~\/context\/ThemeContext\b/g, "~/shared/ui/context/ThemeContext"],
  [/~\/providers\/PostHogProvider\b/g, "~/shared/ui/providers/PostHogProvider"],
  [/~\/widgets\/device-connection-widget\b/g, "~/shared/ui/widgets/device-connection-widget"],
  [/~\/widgets\/dev-indicator\b/g, "~/shared/ui/widgets/dev-indicator"],
  [/~\/hooks\/use-theme-colors\b/g, "~/shared/ui/hooks/use-theme-colors"],
  [/~\/hooks\/use-theme\b/g, "~/shared/ui/hooks/use-theme"],
  [/~\/hooks\/use-is-online\b/g, "~/shared/ui/hooks/use-is-online"],
  [/~\/hooks\/use-multi-tap-action\b/g, "~/shared/ui/hooks/use-multi-tap-action"],
  [/~\/hooks\/use-multi-tap-reveal\b/g, "~/shared/ui/hooks/use-multi-tap-reveal"],

  // ---------- shared/utils, shared/constants, shared/types, shared/stores ----------
  // (these are catch-all prefixes - must come AFTER feature-specific rules above)
  [/~\/api\//g, "~/shared/api/"],
  [/~\/utils\//g, "~/shared/utils/"],
  [/~\/constants\//g, "~/shared/constants/"],
  [/~\/types\//g, "~/shared/types/"],
  [/~\/stores\/environment-store\b/g, "~/shared/stores/environment-store"],
  [/~\/lib\/posthog\b/g, "~/shared/utils/posthog"],
  [/~\/env\b/g, "~/shared/utils/env"],
];

let filesChanged = 0;
let totalReplacements = 0;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".expo" || entry === "dist" || entry === ".turbo" || entry === "android" || entry === "ios" || entry === "scripts") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;
  let changes = 0;
  for (const [pattern, replacement] of RULES) {
    const matches = after.match(pattern);
    if (matches) {
      changes += matches.length;
      after = after.replace(pattern, replacement);
    }
  }
  if (after !== before) {
    writeFileSync(file, after);
    filesChanged += 1;
    totalReplacements += changes;
    console.log(`  ${file}: ${changes} replacement${changes === 1 ? "" : "s"}`);
  }
}

console.log(`\n${filesChanged} files changed, ${totalReplacements} total replacements`);
