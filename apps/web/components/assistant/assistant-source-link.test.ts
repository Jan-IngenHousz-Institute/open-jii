import { describe, expect, it } from "vitest";

import { resolveAssistantSourceLink } from "./assistant-source-link";

describe("assistant source links", () => {
  it.each(["http://localhost:3010", "https://docs.dev.openjii.org/"])(
    "resolves new and persisted docs citations with %s",
    (origin) => {
      for (const prefix of ["", "/docs"]) {
        for (const section of ["guide", "developers", "api"]) {
          expect(resolveAssistantSourceLink(`${prefix}/${section}/index.mdx#intro`, origin)).toBe(
            `${new URL(origin).origin}/${section}#intro`,
          );
          expect(
            resolveAssistantSourceLink(`${prefix}/${section}/example?tab=api#field`, origin),
          ).toBe(`${new URL(origin).origin}/${section}/example?tab=api#field`);
        }
      }
    },
  );

  it.each(["https://openjii.org", "http://localhost:3000", "https://dev.openjii.org"])(
    "repairs legacy absolute docs links from platform origin %s",
    (platformOrigin) => {
      expect(
        resolveAssistantSourceLink(
          `${platformOrigin}/docs/guide/index#intro`,
          "http://localhost:3010",
          platformOrigin,
        ),
      ).toBe("http://localhost:3010/guide#intro");
    },
  );

  it.each([
    "/platform/experiments/123",
    "/platform/assistant/corpus/123",
    "https://paper.example/docs/guide/research",
    "https://docs.other.example/guide/research",
    "/documentation",
    "https://[invalid/docs/guide",
    "https://openjii.org/platform/experiments/123",
    "/apiary",
    "#section",
    "//paper.example/guide/research",
  ])("leaves unrelated URL %s unchanged", (url) => {
    expect(resolveAssistantSourceLink(url, "http://localhost:3010")).toBe(url);
  });
});
