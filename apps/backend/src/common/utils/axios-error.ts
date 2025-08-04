import type { AxiosError } from "axios";
import { isAxiosError } from "axios";

/**
 * Extracts a user-friendly error message from an Axios error
 *
 * @param error The error to extract a message from
 * @returns A user-friendly error message
 */
export function getAxiosErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string; error_description?: string } | undefined>(error)) {
    const message = extractAxiosErrorDetails(error);
    return error.response?.status ? `HTTP ${error.response.status}: ${message}` : message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extracts detailed error information from an Axios error response
 *
 * @param axiosError The Axios error to extract details from
 * @returns The extracted error message
 */
export function extractAxiosErrorDetails(
  axiosError: AxiosError<{ message?: string; error_description?: string } | undefined>,
): string {
  return (
    axiosError.response?.data?.message ??
    axiosError.response?.data?.error_description ??
    (axiosError.message || "Unknown error")
  );
}
