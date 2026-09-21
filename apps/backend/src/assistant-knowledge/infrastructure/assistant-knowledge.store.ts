import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeCorpusWork } from "../core/assistant-knowledge.models";
import type {
  AssistantKnowledgeState,
  StoredAssistantDocument,
  StoredCorpusWork,
} from "../core/assistant-knowledge.models";
import { AUTHORED_CORPUS_FIXTURE } from "./authored-corpus.fixture";

@Injectable()
export class AssistantKnowledgeStore {
  private readonly dataDirectory: string;
  private readonly statePath: string;
  private state: AssistantKnowledgeState | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(configService: ConfigService) {
    this.dataDirectory = path.resolve(
      configService.get<string>("ASSISTANT_KNOWLEDGE_DATA_DIR") ??
        path.join(process.cwd(), ".cache", "assistant-knowledge"),
    );
    this.statePath = path.join(this.dataDirectory, "state.json");
  }

  getDataDirectory(): string {
    return this.dataDirectory;
  }

  async listCorpusWorks(): Promise<StoredCorpusWork[]> {
    return structuredClone((await this.load()).corpusWorks.map(normalizeCorpusWork));
  }

  async getCorpusWork(workId: string): Promise<StoredCorpusWork | null> {
    const work = (await this.load()).corpusWorks.find((candidate) => candidate.id === workId);
    return work ? structuredClone(normalizeCorpusWork(work)) : null;
  }

  async saveCorpusWork(work: StoredCorpusWork): Promise<StoredCorpusWork> {
    await this.update((state) => {
      const index = state.corpusWorks.findIndex((candidate) => candidate.id === work.id);
      if (index === -1) {
        state.corpusWorks.push(structuredClone(work));
      } else {
        state.corpusWorks[index] = structuredClone(work);
      }
    });
    return structuredClone(normalizeCorpusWork(work));
  }

  async listDocuments(ownerUserId: string): Promise<StoredAssistantDocument[]> {
    return structuredClone(
      (await this.load()).documents.filter((document) => document.ownerUserId === ownerUserId),
    );
  }

  async getDocument(
    documentId: string,
    ownerUserId: string,
  ): Promise<StoredAssistantDocument | null> {
    const document = (await this.load()).documents.find(
      (candidate) => candidate.id === documentId && candidate.ownerUserId === ownerUserId,
    );
    return document ? structuredClone(document) : null;
  }

  async saveDocument(document: StoredAssistantDocument): Promise<StoredAssistantDocument> {
    await this.update((state) => {
      const index = state.documents.findIndex((candidate) => candidate.id === document.id);
      if (index === -1) {
        state.documents.push(structuredClone(document));
      } else {
        state.documents[index] = structuredClone(document);
      }
    });
    return structuredClone(document);
  }

  async removeDocument(documentId: string, ownerUserId: string): Promise<boolean> {
    let removed = false;
    await this.update((state) => {
      const next = state.documents.filter(
        (candidate) => candidate.id !== documentId || candidate.ownerUserId !== ownerUserId,
      );
      removed = next.length !== state.documents.length;
      state.documents = next;
    });
    return removed;
  }

  private async load(): Promise<AssistantKnowledgeState> {
    if (this.state) {
      return this.state;
    }
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    try {
      const parsed = JSON.parse(
        await readFile(this.statePath, "utf8"),
      ) as Partial<AssistantKnowledgeState> & { version?: number };
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.corpusWorks) ||
        !Array.isArray(parsed.documents)
      ) {
        throw new Error("Unsupported assistant knowledge state file");
      }
      this.state = parsed as AssistantKnowledgeState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      this.state = {
        version: 1,
        corpusWorks: [structuredClone(AUTHORED_CORPUS_FIXTURE)],
        documents: [],
      };
      await this.persist(this.state);
    }
    return this.state;
  }

  private async update(mutator: (state: AssistantKnowledgeState) => void): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const state = await this.load();
      mutator(state);
      await this.persist(state);
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  private async persist(state: AssistantKnowledgeState): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.statePath);
  }
}
