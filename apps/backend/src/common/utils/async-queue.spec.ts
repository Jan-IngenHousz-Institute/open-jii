import type { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { AsyncQueue } from "./async-queue";

describe("AsyncQueue", () => {
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  } & Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    } as unknown as {
      debug: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      log: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
    } & Logger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a queue with default concurrency of 1", () => {
      const queue = new AsyncQueue(undefined, mockLogger);
      const status = queue.getStatus();

      expect(status.concurrency).toBe(1);
      expect(status.queueLength).toBe(0);
      expect(status.running).toBe(0);
      expect(status.id).toMatch(/^queue-[a-z0-9]{8}$/);
    });

    it("should create a queue with specified concurrency", () => {
      const queue = new AsyncQueue(3, mockLogger);
      const status = queue.getStatus();

      expect(status.concurrency).toBe(3);
    });

    it("should create a default logger if none provided", () => {
      const queue = new AsyncQueue(1);
      expect(queue).toBeDefined();
      // Should not throw when using the logger
      queue.add(() => Promise.resolve());
    });

    it("should log queue creation", () => {
      new AsyncQueue(2, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^Created new AsyncQueue queue-[a-z0-9]{8} with concurrency 2$/),
      );
    });
  });

  describe("add", () => {
    it("should add tasks to the queue and process them", async () => {
      const queue = new AsyncQueue(1, mockLogger);
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      let taskExecuted = false;

      queue.add(async () => {
        await delay(50);
        taskExecuted = true;
      }, "test-task");

      // Immediately after adding, task should be running (not queued)
      const status = queue.getStatus();
      expect(status.running).toBe(1);
      expect(status.queueLength).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Queued test-task\. Queue length: 1, running: 0\/1/),
      );

      await queue.waitForCompletion();
      expect(taskExecuted).toBe(true);
    });

    it("should queue multiple tasks when concurrency is exceeded", async () => {
      const queue = new AsyncQueue(1, mockLogger);
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      // Add first task that will start immediately
      queue.add(async () => {
        await delay(100);
      }, "task-1");

      // Add second task that should be queued
      queue.add(async () => {
        await delay(50);
      }, "task-2");

      // Give a moment for the first task to start
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      const status = queue.getStatus();
      expect(status.running).toBe(1);
      expect(status.queueLength).toBe(1);

      await queue.waitForCompletion();
    });

    it("should generate task identifier when none provided", () => {
      const queue = new AsyncQueue(1, mockLogger);
      const task = vi.fn().mockResolvedValue(undefined);

      queue.add(task);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Queued task-1\. Queue length: 1, running: 0\/1/),
      );
    });
  });

  describe("task processing", () => {
    it("should process tasks sequentially with concurrency 1", async () => {
      const queue = new AsyncQueue(1, mockLogger);
      const results: number[] = [];
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      // Add tasks that record their execution order
      queue.add(async () => {
        await delay(50);
        results.push(1);
      }, "task-1");

      queue.add(async () => {
        await delay(25);
        results.push(2);
      }, "task-2");

      queue.add(() => {
        results.push(3);
        return Promise.resolve();
      }, "task-3");

      await queue.waitForCompletion();

      // Tasks should complete in order due to concurrency limit
      expect(results).toEqual([1, 2, 3]);
      expect(queue.isIdle()).toBe(true);
    });

    it("should process tasks concurrently with higher concurrency", async () => {
      const queue = new AsyncQueue(3, mockLogger);
      const results: number[] = [];
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      // Add tasks with different delays
      queue.add(async () => {
        await delay(100);
        results.push(1);
      }, "slow-task");

      queue.add(async () => {
        await delay(50);
        results.push(2);
      }, "medium-task");

      queue.add(async () => {
        await delay(25);
        results.push(3);
      }, "fast-task");

      await queue.waitForCompletion();

      // Faster tasks should complete first
      expect(results).toEqual([3, 2, 1]);
      expect(queue.isIdle()).toBe(true);
    });

    it("should handle task errors gracefully", async () => {
      const queue = new AsyncQueue(1, mockLogger);
      const results: string[] = [];

      queue.add(() => {
        results.push("success-1");
        return Promise.resolve();
      }, "success-task-1");

      queue.add(() => {
        throw new Error("Test error");
        return Promise.resolve();
      }, "error-task");

      queue.add(() => {
        results.push("success-2");
        return Promise.resolve();
      }, "success-task-2");

      await queue.waitForCompletion();

      // Should continue processing despite error
      expect(results).toEqual(["success-1", "success-2"]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing task: Test error/),
      );
    });

    it("should handle non-Error thrown values", async () => {
      const queue = new AsyncQueue(1, mockLogger);

      queue.add(() => {
        throw new Error("string error");
        return Promise.resolve();
      }, "string-error-task");

      await queue.waitForCompletion();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing task: string error/),
      );
    });
  });

  describe("waitForCompletion", () => {
    it("should resolve immediately when queue is empty and nothing running", async () => {
      const queue = new AsyncQueue(1, mockLogger);

      const startTime = Date.now();
      await queue.waitForCompletion();
      const endTime = Date.now();

      // Should complete almost immediately
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/No tasks in queue or processing, completing immediately/),
      );
    });

    it("should wait for all tasks to complete", async () => {
      const queue = new AsyncQueue(2, mockLogger);
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      let completed = 0;

      // Add multiple tasks
      for (let i = 0; i < 5; i++) {
        queue.add(async () => {
          await delay(50);
          completed++;
        }, `task-${i}`);
      }

      await queue.waitForCompletion();

      expect(completed).toBe(5);
      expect(queue.isIdle()).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return correct status information", async () => {
      const queue = new AsyncQueue(2, mockLogger);
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      // Initial status
      let status = queue.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.running).toBe(0);
      expect(status.concurrency).toBe(2);
      expect(status.id).toMatch(/^queue-[a-z0-9]{8}$/);

      // Add tasks
      queue.add(async () => {
        await delay(100);
      }, "task-1");
      queue.add(async () => {
        await delay(100);
      }, "task-2");
      queue.add(async () => {
        await delay(100);
      }, "task-3");

      // Give tasks time to start
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      status = queue.getStatus();
      expect(status.queueLength).toBe(1); // One task should be queued
      expect(status.running).toBe(2); // Two tasks should be running

      await queue.waitForCompletion();

      status = queue.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.running).toBe(0);
    });
  });

  describe("isIdle", () => {
    it("should return true when queue is empty and nothing running", () => {
      const queue = new AsyncQueue(1, mockLogger);
      expect(queue.isIdle()).toBe(true);
    });

    it("should return false when tasks are queued", () => {
      const queue = new AsyncQueue(1, mockLogger);
      queue.add(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }, "long-task");

      expect(queue.isIdle()).toBe(false);
    });
  });

  describe("generic type support", () => {
    it("should support typed return values", async () => {
      const queue = new AsyncQueue<string>(1, mockLogger);
      const results: string[] = [];

      // eslint-disable-next-line @typescript-eslint/require-await
      queue.add(async () => {
        const result = "test-result";
        results.push(result);
        return result;
      }, "typed-task");

      await queue.waitForCompletion();

      expect(results).toEqual(["test-result"]);
    });

    it("should work with void return type by default", async () => {
      const queue = new AsyncQueue(1, mockLogger);
      let executed = false;

      queue.add(() => {
        executed = true;
        return Promise.resolve();
      }, "void-task");

      await queue.waitForCompletion();

      expect(executed).toBe(true);
    });
  });

  describe("logging behavior", () => {
    it("should log task processing lifecycle", async () => {
      const queue = new AsyncQueue(1, mockLogger);

      queue.add(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }, "lifecycle-task");

      await queue.waitForCompletion();

      // Check for key log messages
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringMatching(/Queued lifecycle-task/));
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Processing task: 1 running, 0 in queue/),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Task processed successfully, 0 remaining in queue/),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/All tasks processed, queue empty/),
      );
    });
  });
});
