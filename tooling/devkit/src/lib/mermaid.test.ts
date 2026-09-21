import { describe, expect, it } from "vitest";

import { checkMermaid, extractMermaidBlocks } from "./mermaid.js";

const valid = "flowchart LR\n  A[Filter widgets] --> B[useChartData]\n";
const broken = 'flowchart TB\n  U[Section<br/>"Your experiments", 3 cards]\n';

describe("extractMermaidBlocks", () => {
  it("numbers the fenced mermaid blocks and ignores other fences", () => {
    const markdown = `text\n\n\`\`\`mermaid\n${valid}\`\`\`\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n\n\`\`\`mermaid\n${broken}\`\`\`\n`;

    expect(extractMermaidBlocks(markdown)).toEqual([
      { index: 1, source: valid },
      { index: 2, source: broken },
    ]);
  });
});

describe("checkMermaid", () => {
  it("is silent without blocks and never loads the parser", async () => {
    await expect(checkMermaid([])).resolves.toEqual([]);
  });

  it("names the diagram that mermaid refuses, with the position and nothing else", async () => {
    const findings = await checkMermaid([
      { index: 1, source: valid },
      { index: 2, source: broken },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("mermaid");
    expect(findings[0]?.detail).toMatch(/^diagram 2: Parse error/);
    expect(findings[0]?.detail).not.toContain("\n");
  });
});
