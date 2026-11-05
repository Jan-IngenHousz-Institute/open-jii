import { describe, expect, it } from "vitest";

import { generateOpenApiDocument } from "./openapi";

describe("OpenAPI rolling-window schema", () => {
  it("retains required preset constraints inside dashboard table filters", async () => {
    const document = await generateOpenApiDocument();
    expect(document.components?.schemas?.ExperimentRelativeTimeWindow).toEqual({
      anyOf: [
        {
          type: "object",
          properties: { last: { anyOf: [{ const: 1 }, { const: 24 }] }, unit: { const: "hours" } },
          required: ["last", "unit"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            last: { anyOf: [{ const: 7 }, { const: 30 }, { const: 90 }] },
            unit: { const: "days" },
          },
          required: ["last", "unit"],
          additionalProperties: false,
        },
      ],
    });
    expect(JSON.stringify(document.components?.schemas?.ExperimentDataFilterValue)).not.toContain(
      "{}",
    );
    expect(document.components?.schemas?.ExperimentDataFilterValue).toHaveProperty(
      "anyOf",
      expect.arrayContaining([{ $ref: "#/components/schemas/ExperimentRelativeTimeWindow" }]),
    );
    for (const path of [
      "/api/v1/experiments/{id}/dashboards",
      "/api/v1/experiments/{id}/dashboards/{dashboardId}",
    ]) {
      expect(JSON.stringify(document.paths?.[path])).toContain(
        '"$ref":"#/components/schemas/ExperimentDataFilterValue"',
      );
    }
  });
});
