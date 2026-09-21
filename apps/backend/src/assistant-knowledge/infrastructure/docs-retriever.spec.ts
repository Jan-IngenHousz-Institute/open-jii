import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DocsRetriever } from "./docs-retriever";

describe("DocsRetriever", () => {
  let docsRoot: string;

  beforeEach(async () => {
    docsRoot = await mkdtemp(path.join(tmpdir(), "openjii-docs-"));
    await mkdir(path.join(docsRoot, "guide"));
    await writeFile(
      path.join(docsRoot, "guide", "measurements.mdx"),
      `---\ntitle: "Measurement guide"\n---\n# Configure a sensor\nCalibrate chlorophyll fluorescence sensors before each field campaign.`,
    );
  });

  afterEach(async () => {
    await rm(docsRoot, { recursive: true, force: true });
  });

  it("reads real MDX files and returns a route-backed citation", async () => {
    const retriever = new DocsRetriever(new ConfigService({ ASSISTANT_DOCS_ROOT: docsRoot }));

    const hits = await retriever.search("chlorophyll fluorescence", 5);

    expect(hits).toHaveLength(1);
    expect(hits[0]?.citation).toMatchObject({
      sourceType: "docs",
      sourceId: "docs:guide/measurements.mdx",
      title: "Measurement guide",
      route: "/guide/measurements",
    });
    expect(hits[0]?.citation.sourceUrl).toBe("https://docs.openjii.org/guide/measurements");
    expect(hits[0]?.excerpt).toContain("chlorophyll fluorescence");
  });
  it.each(["http://localhost:3010", "https://docs.dev.openjii.org/"])(
    "resolves index pages against %s while retaining portable routes",
    async (docsUrl) => {
      await mkdir(path.join(docsRoot, "developers"));
      await writeFile(
        path.join(docsRoot, "developers", "index.mdx"),
        "# Developer reference\nChlorophyll integration",
      );
      await mkdir(path.join(docsRoot, "api"));
      await writeFile(
        path.join(docsRoot, "api", "index.mdx"),
        "# API reference\nChlorophyll endpoints",
      );
      const retriever = new DocsRetriever(
        new ConfigService({ ASSISTANT_DOCS_ROOT: docsRoot, DOCS_URL: docsUrl }),
      );
      const hits = await retriever.search("chlorophyll", 5);
      expect(hits.map((hit) => hit.citation.route)).toEqual(
        expect.arrayContaining(["/guide/measurements", "/developers", "/api"]),
      );
      for (const hit of hits) {
        expect(hit.citation.sourceUrl).toBe(`${new URL(docsUrl).origin}${hit.citation.route}`);
      }
    },
  );
});
