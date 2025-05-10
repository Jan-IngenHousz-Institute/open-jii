type Handler<T> = T extends void
  ? () => void | Promise<void>
  : (payload: T) => void | Promise<void>;
type ErrorHandler = (
  error: unknown,
  context: { event: string; payload: any },
) => void;

export class Emitter<Events extends Record<string, any>> {
  private handlers = new Map<keyof Events, Set<Handler<any>>>();
  private history = new Map<keyof Events, Events[keyof Events] | undefined>();
  private errorHandler: ErrorHandler = console.log;

  async emit<K extends keyof Events>(
    event: K,
    ...args: Events[K] extends void ? [] : [payload: Events[K]]
  ): Promise<void> {
    const payload = args[0];
    const listeners = this.handlers.get(event);

    if (!listeners || listeners.size === 0) {
      if (!this.history.has(event)) {
        this.history.set(event, payload);
      }
      return;
    }

    const promises: Promise<void>[] = [];

    for (const handler of listeners) {
      try {
        const result = (handler as Handler<Events[K]>)(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        this.errorHandler(err, { event: String(event), payload });
        throw err; // throw immediately for sync errors
      }
    }

    try {
      await Promise.all(promises);
    } catch (err) {
      this.errorHandler(err, { event: String(event), payload });
      throw err; // rethrow to make emit fail
    }
  }

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    let listeners = this.handlers.get(event);
    if (!listeners) {
      listeners = new Set();
      this.handlers.set(event, listeners);
    }

    const payload = this.history.get(event);
    if (payload !== undefined) {
      try {
        const result = (handler as any)(payload);
        if (result instanceof Promise) {
          result.catch((err: unknown) =>
            this.errorHandler(err, { event: String(event), payload }),
          );
        }
      } catch (err) {
        this.errorHandler(err, { event: String(event), payload });
      }

      this.history.delete(event);
    }

    listeners.add(handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }
}
