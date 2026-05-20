import { createLogger } from "./logger";

const log = createLogger("safe-async");

export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => void {
  return function (...args: Parameters<T>): void {
    fn(...args).catch((err) => {
      log.error("caught error", { err: (err as Error)?.message });
    });
  };
}
