import { describe, expect, it, vi } from "vitest";

import en from "@repo/i18n/locales/en-US/status.json";

import { generateMetadata } from "../layout";

vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "font-inter" }) }));

describe("the page metadata", () => {
  it("comes from the status translations", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe(en.metadata.title);
    expect(metadata.description).toBe(en.metadata.description);
  });

  it("keeps the word status in the title, which the deploy gate looks for", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toMatch(/status/i);
  });
});
