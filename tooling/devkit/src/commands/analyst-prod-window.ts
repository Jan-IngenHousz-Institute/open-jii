import { rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { repositoryRoot } from "../lib/config.js";

/** Matches PROD_WINDOW_SECONDS in .claude/hooks/analyst-guard.mjs. */
export const WINDOW_SECONDS = 7200;

export function markerPath(root: string): string {
  return join(root, ".claude", "analyst-prod.ok");
}

/**
 * Clamped at both ends. A marker dated in the future, which a clock adjustment is enough to
 * produce, would otherwise report more than a full window and quietly extend it.
 */
export function remainingSeconds(modified: Date, now: Date): number {
  const elapsed = Math.floor((now.getTime() - modified.getTime()) / 1000);
  return Math.min(WINDOW_SECONDS, Math.max(0, WINDOW_SECONDS - elapsed));
}

export function describeRemaining(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export interface WindowDependencies {
  root: string;
  now: () => Date;
  write: (text: string) => void;
  /** Whether a person is at a terminal. An agent's shell never is. */
  interactive: boolean;
  ask: (question: string) => Promise<string>;
}

/** The word the developer types to open the window, so a pasted or scripted call cannot. */
export const CONFIRMATION = "prod";

export async function openWindow(deps: WindowDependencies): Promise<number> {
  if (!deps.interactive) {
    deps.write(
      "Opening production reads needs you at a terminal. Run pnpm analyst:prod-window in your own shell.\n",
    );
    return 1;
  }

  const answer = await deps.ask(`Type ${CONFIRMATION} to open production reads for two hours: `);
  if (answer.trim() !== CONFIRMATION) {
    deps.write("Production reads stay closed.\n");
    return 1;
  }

  const path = markerPath(deps.root);
  await writeFile(path, `opened ${deps.now().toISOString()}\n`, { mode: 0o600 });
  deps.write(
    `Production reads are open for ${describeRemaining(WINDOW_SECONDS)}. Close it early with --close.\n` +
      "The agent still cannot change anything, and it must state its plan before reading.\n",
  );
  return 0;
}

export async function closeWindow(deps: WindowDependencies): Promise<number> {
  await rm(markerPath(deps.root), { force: true });
  deps.write("Production reads are closed.\n");
  return 0;
}

export async function reportWindow(deps: WindowDependencies): Promise<number> {
  try {
    const stats = await stat(markerPath(deps.root));
    const left = remainingSeconds(stats.mtime, deps.now());
    deps.write(
      left > 0
        ? `Production reads are open for another ${describeRemaining(left)}.\n`
        : "The production window has expired. Reopen it with pnpm analyst:prod-window.\n",
    );
  } catch {
    deps.write("Production reads are closed.\n");
  }
  return 0;
}

export async function run(args: string[]): Promise<number> {
  const deps: WindowDependencies = {
    root: repositoryRoot(),
    now: () => new Date(),
    write: (text) => process.stdout.write(text),
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ask: async (question) => {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await prompt.question(question);
      } finally {
        prompt.close();
      }
    },
  };

  if (args.includes("--close")) return closeWindow(deps);
  if (args.includes("--status")) return reportWindow(deps);
  return openWindow(deps);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
