/**
 * Simple event emitter for device communication
 */

type EventCallback<T> = (payload: T) => void | Promise<void>;

export class Emitter<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<EventCallback<unknown>>>();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.add(callback as EventCallback<unknown>);
    }
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  async emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void> {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const promises: Promise<void>[] = [];
    for (const callback of callbacks) {
      const result = callback(payload);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }

    await Promise.all(promises);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
