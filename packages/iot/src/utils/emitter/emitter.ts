/**
 * Simple event emitter for device communication
 */
import type { Logger } from "../logger/logger";
import { defaultLogger } from "../logger/logger";

type EventCallback<T> = (payload: T) => void | Promise<void>;

export class Emitter<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<EventCallback<unknown>>>();

  constructor(private readonly log: Logger = defaultLogger) {}

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.add(callback as EventCallback<unknown>);
    }
  }

  /** Register a one-shot listener that is automatically removed after the first invocation. */
  once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const wrapper: EventCallback<EventMap[K]> = (payload) => {
      this.off(event, wrapper);
      return callback(payload);
    };
    this.on(event, wrapper);
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
      try {
        const result = callback(payload);
        if (result instanceof Promise) {
          promises.push(result.catch((err) => this.log.error("Emitter listener error:", err)));
        }
      } catch (err) {
        this.log.error("Emitter listener error:", err);
      }
    }

    await Promise.all(promises);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
