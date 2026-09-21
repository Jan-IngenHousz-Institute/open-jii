import { zAssistantKnowledgeSourceUrl } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";
import type {
  AssistantPrivateDocument,
  CorpusWork,
} from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

export interface StoredCorpusWork extends CorpusWork {
  localFilePath: string | null;
  databricksFilePath: string | null;
}

export interface StoredAssistantDocument extends AssistantPrivateDocument {
  localFilePath: string;
  databricksFilePath: string | null;
}

export interface AssistantKnowledgeState {
  version: 1;
  corpusWorks: StoredCorpusWork[];
  documents: StoredAssistantDocument[];
}

export function normalizeCorpusWork(work: StoredCorpusWork): StoredCorpusWork {
  const sourceUrl = zAssistantKnowledgeSourceUrl.safeParse(work.sourceUrl);
  return { ...work, sourceUrl: sourceUrl.success ? sourceUrl.data : null };
}

export function publicCorpusWork(work: StoredCorpusWork): CorpusWork {
  const {
    localFilePath: _localFilePath,
    databricksFilePath: _databricksFilePath,
    ...result
  } = normalizeCorpusWork(work);
  return result;
}

export function publicDocument(document: StoredAssistantDocument): AssistantPrivateDocument {
  const {
    localFilePath: _localFilePath,
    databricksFilePath: _databricksFilePath,
    ...result
  } = document;
  return result;
}
