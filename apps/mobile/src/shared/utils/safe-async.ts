import { createLogger } from "./logger";

const log = createLogger("safe-async");

export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => void {
  return function (...args: Parameters<T>): void {
    // Promise.resolve().then(...) so a synchronous throw inside `fn` (before
    // it returns its promise) is funneled into the same catch as an async
    // rejection — a bare `fn(...).catch` would let the sync throw escape.
    Promise.resolve()
      .then(() => fn(...args))
      .catch((err) => {
        log.error("caught error", { err: (err as Error)?.message });
      });
  };
}
