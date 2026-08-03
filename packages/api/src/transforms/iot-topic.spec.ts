import { describe, expect, it } from "vitest";

import { buildIngestTopicPrefix } from "./iot-topic";

describe("buildIngestTopicPrefix", () => {
  it("builds the platform-owned prefix of the ingest channel", () => {
    expect(buildIngestTopicPrefix("11111111-1111-4111-8111-111111111111", "ambyte")).toBe(
      "experiment/data_ingest/v1/11111111-1111-4111-8111-111111111111/ambyte",
    );
  });
});
