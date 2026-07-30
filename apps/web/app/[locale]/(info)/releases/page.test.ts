import { describe, expect, it } from "vitest";

import { generateMetadata } from "./page";

describe("releases metadata", () => {
  it("uses the exact locale-prefixed canonical and advertises only the default locale", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(metadata.alternates).toEqual({
      canonical: "/en-US/releases",
      languages: { "en-US": "/en-US/releases" },
    });
  });
});
