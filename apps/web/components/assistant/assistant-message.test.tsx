import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { AssistantResponse } from "./assistant-message";

vi.mock("~/env", () => ({ env: { NEXT_PUBLIC_DOCS_URL: "http://localhost:3010/" } }));

describe("AssistantResponse citation links", () => {
  it("resolves inline and reference Markdown citations without changing entity or external links", async () => {
    render(
      <AssistantResponse
        content={[
          "[Old guide](/docs/guide/index#intro)",
          "[New API](/api/rest)",
          "[Old absolute](https://openjii.org/docs/guide/get-started/quick-start)",
          "[Developer reference][dev]",
          "[Experiment](/platform/experiments/123)",
          "[Paper](https://paper.example/guide/study)",
          "[Unsafe](javascript:alert%281%29)",
          "",
          "[dev]: /docs/developers/index.mdx",
        ].join("\n\n")}
      />,
    );
    const user = userEvent.setup();
    for (const [label, url] of [
      ["Old guide", "http://localhost:3010/guide#intro"],
      ["New API", "http://localhost:3010/api/rest"],
      ["Old absolute", "http://localhost:3010/guide/get-started/quick-start"],
      ["Developer reference", "http://localhost:3010/developers"],
      ["Experiment", "/platform/experiments/123"],
      ["Paper", "https://paper.example/guide/study"],
    ]) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(screen.getByText(url)).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Close" }));
    }
    expect(screen.getByText("Unsafe [blocked]")).toBeVisible();
  });
});
