export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => void {
  return function (...args: Parameters<T>): void {
    fn(...args).catch((err) => {
      console.error('safeAsync caught an error:', err);
    });
  };
}
