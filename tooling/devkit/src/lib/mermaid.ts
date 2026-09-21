import type { Finding } from "./ticket-standard.js";

export interface MermaidBlock {
  index: number;
  source: string;
}

export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match, index) => ({
    index: index + 1,
    source: match[1],
  }));
}

// Mermaid's parser expects a browser; jsdom stands in for it. Both are loaded lazily so a
// command that never meets a diagram pays nothing for them.
async function loadParser(): Promise<(source: string) => Promise<void>> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ["window", "document", "DOMParser", "SVGElement", "HTMLElement"]) {
    if (globals[name] === undefined) globals[name] = dom.window[name as keyof typeof dom.window];
  }
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false });
  return async (source) => {
    await mermaid.parse(source, { suppressErrors: false });
  };
}

// The first three lines of a mermaid error carry the position and the expected tokens; the rest
// is a stack that says nothing about the diagram.
function firstLines(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").slice(0, 3).join(" | ");
}

export async function checkMermaid(blocks: readonly MermaidBlock[]): Promise<Finding[]> {
  if (blocks.length === 0) return [];
  const parse = await loadParser();
  const findings: Finding[] = [];
  for (const block of blocks) {
    try {
      await parse(block.source);
    } catch (error) {
      findings.push({ rule: "mermaid", detail: `diagram ${block.index}: ${firstLines(error)}` });
    }
  }
  return findings;
}
