import type { AxiosError } from "axios";

import { extractAxiosErrorDetails, getAxiosErrorMessage } from "./axios-error";

describe("axios-error", () => {
  describe("getAxiosErrorMessage", () => {
    it("should handle standard Axios errors", () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: "Bad request",
          },
        },
        message: "Request failed with status 400",
      } as AxiosError;

      expect(getAxiosErrorMessage(error)).toEqual("HTTP 400: Bad request");
    });

    it("should handle Axios errors with error_description", () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error_description: "Invalid credentials",
          },
        },
        message: "Request failed with status 401",
      } as AxiosError;

      expect(getAxiosErrorMessage(error)).toEqual("HTTP 401: Invalid credentials");
    });

    it("should handle Axios errors without response", () => {
      const error = {
        isAxiosError: true,
        message: "Network error",
      } as AxiosError;

      expect(getAxiosErrorMessage(error)).toEqual("Network error");
    });

    it("should handle non-Axios errors", () => {
      const error = new Error("Generic error");
      expect(getAxiosErrorMessage(error)).toEqual("Generic error");
    });

    it("should handle non-error objects", () => {
      expect(getAxiosErrorMessage("Error string")).toEqual("Error string");
      expect(getAxiosErrorMessage(123)).toEqual("123");
      expect(getAxiosErrorMessage(null)).toEqual("null");
    });
  });

  describe("extractAxiosErrorDetails", () => {
    it("should extract message from response data", () => {
      const error = {
        response: {
          data: {
            message: "Custom error message",
          },
        },
        message: "Request failed",
      } as AxiosError;

      expect(extractAxiosErrorDetails(error)).toEqual("Custom error message");
    });

    it("should extract error_description from response data", () => {
      const error = {
        response: {
          data: {
            error_description: "Detailed error description",
          },
        },
        message: "Request failed",
      } as AxiosError;

      expect(extractAxiosErrorDetails(error)).toEqual("Detailed error description");
    });

    it("should fall back to error message if no response data", () => {
      const error = {
        message: "Network error",
      } as AxiosError;

      expect(extractAxiosErrorDetails(error)).toEqual("Network error");
    });

    it("should provide default message if no useful information available", () => {
      const error = {} as AxiosError;
      expect(extractAxiosErrorDetails(error)).toEqual("Unknown error");
    });
  });
});
