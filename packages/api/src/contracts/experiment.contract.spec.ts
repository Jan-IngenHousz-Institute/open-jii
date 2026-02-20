import { describe, it, expect } from "vitest";

import {
  zProjectTransferWebhookPayload,
  zProjectTransferWebhookResponse,
} from "../schemas/experiment.schema";
import { zWebhookAuthHeader, zWebhookErrorResponse } from "../schemas/user.schema";

describe("Experiment Contract Schemas", () => {
  describe("projectTransfer request", () => {
    it("should validate a valid project transfer body", () => {
      const body = {
        experiment: {
          name: "Transferred Experiment",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
        protocol: {
          name: "Transferred Protocol",
          code: [{ measure: true }],
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
        macro: {
          name: "Transferred Macro",
          code: "Y29kZQ==",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = zProjectTransferWebhookPayload.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should reject body missing experiment", () => {
      const body = {
        protocol: {
          name: "P",
          code: [{}],
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
        macro: {
          name: "M",
          code: "Y29kZQ==",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = zProjectTransferWebhookPayload.safeParse(body);
      expect(result.success).toBe(false);
    });

    it("should accept body without protocol", () => {
      const body = {
        experiment: {
          name: "E",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
        macro: {
          name: "M",
          code: "Y29kZQ==",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = zProjectTransferWebhookPayload.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept body without macro", () => {
      const body = {
        experiment: {
          name: "E",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
        protocol: {
          name: "P",
          code: [{}],
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = zProjectTransferWebhookPayload.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept body with only experiment", () => {
      const body = {
        experiment: {
          name: "E",
          createdBy: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = zProjectTransferWebhookPayload.safeParse(body);
      expect(result.success).toBe(true);
    });
  });

  describe("projectTransfer response", () => {
    it("should validate a valid 201 response", () => {
      const response = {
        success: true,
        experimentId: "123e4567-e89b-12d3-a456-426614174000",
        protocolId: "223e4567-e89b-12d3-a456-426614174000",
        macroId: "323e4567-e89b-12d3-a456-426614174000",
        flowId: null,
      };

      const result = zProjectTransferWebhookResponse.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate a response with null protocolId and macroId", () => {
      const response = {
        success: true,
        experimentId: "123e4567-e89b-12d3-a456-426614174000",
        protocolId: null,
        macroId: null,
        flowId: null,
      };

      const result = zProjectTransferWebhookResponse.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate a webhook error response", () => {
      const response = {
        error: "Bad Request",
        message: "Validation failed",
        statusCode: 400,
      };

      const result = zWebhookErrorResponse.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe("projectTransfer headers", () => {
    it("should validate valid webhook auth headers", () => {
      const headers = {
        "x-api-key-id": "test-key-id",
        "x-databricks-signature": "abc123",
        "x-databricks-timestamp": "1700000000",
      };

      const result = zWebhookAuthHeader.safeParse(headers);
      expect(result.success).toBe(true);
    });

    it("should reject missing x-api-key-id", () => {
      const headers = {
        "x-databricks-signature": "abc123",
        "x-databricks-timestamp": "1700000000",
      };

      const result = zWebhookAuthHeader.safeParse(headers);
      expect(result.success).toBe(false);
    });

    it("should reject missing x-databricks-signature", () => {
      const headers = {
        "x-api-key-id": "test-key-id",
        "x-databricks-timestamp": "1700000000",
      };

      const result = zWebhookAuthHeader.safeParse(headers);
      expect(result.success).toBe(false);
    });
  });
});
