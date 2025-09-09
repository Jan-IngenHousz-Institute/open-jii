import type { Logger } from "@nestjs/common";

export interface StreamToBufferOptions {
  maxSize?: number;
  timeoutMs?: number;
  logger?: Logger;
}

/**
 * Convert a readable stream to a buffer with optional size and timeout limits
 * @param stream - The readable stream
 * @param options - Configuration options
 * @returns Promise resolving to a Buffer
 */
export async function streamToBuffer(
  stream: NodeJS.ReadableStream,
  options: StreamToBufferOptions = {},
): Promise<Buffer> {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    timeoutMs = 30000, // 30 seconds default
    logger,
  } = options;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const handleError = (err: unknown) => {
      cleanup();
      const error = err instanceof Error ? err : new Error(String(err));
      logger?.error("Stream error:", error);
      reject(error);
    };

    const handleEnd = () => {
      cleanup();
      try {
        logger?.debug(`Stream ended, concatenating ${chunks.length} chunks`);
        const result = Buffer.concat(chunks);
        // Clear the chunks array to help garbage collection
        chunks.length = 0;
        logger?.debug("Buffer created, chunks cleared");
        resolve(result);
      } catch (err) {
        logger?.error("Error during buffer concatenation:", err);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    // Handle data chunks
    stream.on("data", (chunk) => {
      // Ensure chunk is a Buffer
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buffer.length;

      // Check if we're exceeding the size limit
      if (totalSize > maxSize) {
        cleanup();
        reject(new Error(`Stream exceeds maximum size of ${maxSize / (1024 * 1024)}MB`));
        return;
      }

      chunks.push(buffer as Buffer);
    });

    // Handle errors
    stream.on("error", handleError);

    // Handle completion
    stream.on("end", handleEnd);

    // Set a timeout to prevent hanging (if specified)
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        logger?.warn("Stream processing timeout triggered");
        reject(new Error(`Stream processing timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }
  });
}
