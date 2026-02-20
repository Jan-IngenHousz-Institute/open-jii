/**
 * Async utility functions
 */

/** Delay execution for specified milliseconds */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrap async function to catch errors and log them */
export function safeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      console.error("Async error:", error);
    }
  };
}
