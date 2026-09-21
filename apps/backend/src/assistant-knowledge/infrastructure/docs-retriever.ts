import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { AssistantKnowledgeHit } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

interface DocsChunk {
  id: string;
  title: string;
  route: string;
  content: string;
  terms: Map<string, number>;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function terms(input: string): string[] {
  return input
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function countTerms(input: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms(input)) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

function plainMarkdown(input: string): string {
  return input
    .replace(/^---[\s\S]*?---/u, " ")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[#*_`>{}|]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function titleFromMarkdown(input: string, filePath: string): string {
  const frontmatterTitle = /^---[\s\S]*?^title:\s*["']?([^\n"']+)/mu.exec(input)?.[1]?.trim();
  const heading = /^#\s+(.+)$/mu.exec(input)?.[1]?.trim();
  return frontmatterTitle ?? heading ?? path.basename(filePath).replace(/\.(md|mdx)$/u, "");
}

@Injectable()
export class DocsRetriever {
  private readonly configuredRoot: string | null;
  private readonly docsOrigin: string;
  private chunks: DocsChunk[] | null = null;
  private root: string | null = null;

  constructor(configService: ConfigService) {
    this.configuredRoot = configService.get<string>("ASSISTANT_DOCS_ROOT") ?? null;
    const docsUrl =
      configService.get<string>("DOCS_URL") ??
      (configService.get<string>("NODE_ENV") === "development"
        ? "http://localhost:3010"
        : "https://docs.openjii.org");
    const parsed = new URL(docsUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("DOCS_URL must be an HTTP(S) origin");
    }
    this.docsOrigin = parsed.origin;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.resolveRoot()) !== null;
  }

  async search(query: string, limit: number): Promise<AssistantKnowledgeHit[]> {
    const chunks = await this.loadChunks();
    if (chunks.length === 0) {
      return [];
    }
    const queryTerms = [...new Set(terms(query))];
    if (queryTerms.length === 0) {
      return [];
    }
    return chunks
      .map((chunk) => {
        const score = queryTerms.reduce((total, term) => {
          const count = chunk.terms.get(term) ?? 0;
          return total + (count > 0 ? 1 + Math.log(count) : 0);
        }, 0);
        return { chunk, score };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ chunk, score }) => ({
        citation: {
          sourceType: "docs" as const,
          sourceId: chunk.id,
          title: chunk.title,
          year: null,
          page: null,
          route: chunk.route,
          sourceUrl: new URL(chunk.route, this.docsOrigin).href,
          licenceId: null,
        },
        excerpt: this.excerpt(chunk.content, queryTerms),
        score,
      }));
  }

  private async resolveRoot(): Promise<string | null> {
    if (this.root) {
      return this.root;
    }
    const candidates = [
      this.configuredRoot,
      path.resolve(process.cwd(), "apps/docs/content"),
      path.resolve(process.cwd(), "../../apps/docs/content"),
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      try {
        if ((await stat(candidate)).isDirectory()) {
          this.root = candidate;
          return candidate;
        }
      } catch {
        // Try the next deterministic monorepo location.
      }
    }
    return null;
  }

  private async loadChunks(): Promise<DocsChunk[]> {
    if (this.chunks) {
      return this.chunks;
    }
    const root = await this.resolveRoot();
    if (!root) {
      return [];
    }
    const files = await this.walk(root);
    this.chunks = await Promise.all(
      files.map(async (filePath) => {
        const raw = await readFile(filePath, "utf8");
        const content = plainMarkdown(raw);
        const relative = path.relative(root, filePath).replace(/\\/gu, "/");
        const route = `/${relative.replace(/(?:\/index)?\.mdx?$/u, "")}`;
        return {
          id: `docs:${relative}`,
          title: titleFromMarkdown(raw, filePath),
          route,
          content,
          terms: countTerms(`${titleFromMarkdown(raw, filePath)} ${content}`),
        };
      }),
    );
    return this.chunks;
  }

  private async walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walk(fullPath)));
      } else if (entry.isFile() && /\.mdx?$/u.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private excerpt(content: string, queryTerms: string[]): string {
    const lower = content.toLocaleLowerCase();
    const positions = queryTerms
      .map((term) => lower.indexOf(term))
      .filter((position) => position >= 0);
    const match = positions.length > 0 ? Math.min(...positions) : 0;
    const start = Math.max(0, match - 160);
    const end = Math.min(content.length, match + 420);
    return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${end < content.length ? "…" : ""}`;
  }
}
