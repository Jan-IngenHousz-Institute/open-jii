/**
 * Async command queue — serializes async operations so only one runs at a time.
 * Prevents response-matching race conditions on serial/BLE transports.
 */

export class CommandQueue {
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Enqueue an async operation. It will not start until all previously
   * enqueued operations have settled (resolved or rejected).
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    // Keep the chain alive regardless of success/failure
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
