import { Logger } from "@nestjs/common";

/**
 * A generic queue implementation for controlled asynchronous task processing
 * Helps prevent memory issues and race conditions by limiting concurrency
 */
export class AsyncQueue<T = void> {
  private queue: (() => Promise<T>)[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly logger: Logger;
  private readonly id: string;

  constructor(concurrency = 1, logger?: Logger) {
    this.concurrency = concurrency;
    this.logger = logger ?? new Logger(AsyncQueue.name);
    this.id = `queue-${Math.random().toString(36).substring(2, 10)}`;
    this.logger.debug({
      msg: "Created new AsyncQueue",
      operation: "constructor",
      context: AsyncQueue.name,
      queueId: this.id,
      concurrency,
    });
  }

  /**
   * Add a task to the queue
   * @param task The async function to execute
   * @param taskId Optional identifier for logging purposes
   */
  add(task: () => Promise<T>, taskId?: string): void {
    this.queue.push(task);
    const queueLength = this.queue.length;
    const identifier = taskId ?? `task-${queueLength}`;
    this.logger.debug(
      `[Queue ${this.id}] Queued ${identifier}. Queue length: ${queueLength}, running: ${this.running}/${this.concurrency}`,
    );
    // Using void to explicitly mark promise as handled elsewhere
    void this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.logger.debug({
        msg: "Queue empty",
        operation: "processQueue",
        context: AsyncQueue.name,
        queueId: this.id,
      });
      return;
    }

    if (this.running >= this.concurrency) {
      this.logger.debug(
        `[Queue ${this.id}] Max concurrency reached (${this.running}/${this.concurrency}), waiting for completion`,
      );
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    this.logger.debug(
      `[Queue ${this.id}] Processing task: ${this.running} running, ${this.queue.length} in queue`,
    );

    try {
      await item();
      this.logger.debug(
        `[Queue ${this.id}] Task processed successfully, ${this.queue.length} remaining in queue`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `[Queue ${this.id}] Error processing task: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running--;
      this.logger.debug(
        `[Queue ${this.id}] Completed processing, now ${this.running} running, ${this.queue.length} in queue`,
      );
      // Using void to explicitly mark promise as handled elsewhere
      void this.processNext();
    }
  }

  /**
   * Wait for all queued tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    if (this.queue.length === 0 && this.running === 0) {
      this.logger.debug(
        `[Queue ${this.id}] No tasks in queue or processing, completing immediately`,
      );
      return;
    }

    this.logger.debug(
      `[Queue ${this.id}] Waiting for completion: ${this.queue.length} tasks in queue, ${this.running} running`,
    );

    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.queue.length === 0 && this.running === 0) {
          this.logger.debug({
            msg: "All tasks processed, queue empty",
            operation: "waitForCompletion",
            context: AsyncQueue.name,
            queueId: this.id,
          });
          clearInterval(checkInterval);
          resolve();
        } else {
          this.logger.debug(
            `[Queue ${this.id}] Still waiting: ${this.queue.length} in queue, ${this.running} running`,
          );
        }
      }, 100);
    });
  }

  /**
   * Get the current status of the queue
   */
  getStatus(): { queueLength: number; running: number; concurrency: number; id: string } {
    return {
      queueLength: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
      id: this.id,
    };
  }

  /**
   * Check if the queue is idle (no tasks running or queued)
   */
  isIdle(): boolean {
    return this.queue.length === 0 && this.running === 0;
  }
}
