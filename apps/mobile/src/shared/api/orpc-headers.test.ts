import { describe, it, expect } from "vitest";
import { orpcClientHeaders } from "~/shared/api/orpc-headers";

import { DYNAMIC_COMMAND_REF_CAPABILITY } from "@repo/api/domains/workbook/capabilities";

describe("orpcClientHeaders", () => {
  it("advertises the dynamic-command-ref capability", () => {
    expect(orpcClientHeaders()["x-openjii-capabilities"]).toBe(DYNAMIC_COMMAND_REF_CAPABILITY);
  });

  it("keeps the app-source header", () => {
    expect(orpcClientHeaders()["x-app-source"]).toBe("orpc");
  });
});
