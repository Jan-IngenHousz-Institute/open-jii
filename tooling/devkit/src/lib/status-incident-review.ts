import { createHash } from "node:crypto";

import { publicationState } from "./content-model.js";
import type { Entry } from "./contentful-management.js";

interface Subject {
  kind: "incident" | "update";
  id: string;
  version: number;
}

export interface ReviewSummary {
  token: string;
  covers: string[];
}

const TOKEN_LENGTH = 12;

// Publishing an entry adds one to its version without touching its content, so a published
// entry counts at the version it was published from. That keeps a review valid across a publish
// that stopped half way.
function contentVersion(sys: Entry["sys"]): number {
  const { version, publishedVersion } = sys;
  const isPublishedAsSaved = publicationState(version, publishedVersion) === "published";

  return isPublishedAsSaved ? (publishedVersion ?? version) : version;
}

/** The exact entries and versions a person read, as a short token publish checks again. */
export class Review {
  private constructor(private readonly subjects: Subject[]) {}

  static of(incident: Entry, updates: Entry[]): Review {
    const subject = (kind: Subject["kind"], entry: Entry): Subject => ({
      kind,
      id: entry.sys.id,
      version: contentVersion(entry.sys),
    });

    return new Review([subject("incident", incident), ...updates.map((u) => subject("update", u))]);
  }

  get token(): string {
    const canonical = JSON.stringify(this.subjects.map(({ id, version }) => [id, version]));
    return createHash("sha256").update(canonical).digest("hex").slice(0, TOKEN_LENGTH);
  }

  covers(): string[] {
    return this.subjects.map(({ kind, id, version }) => `${kind} ${id}, saved version ${version}`);
  }

  summary(): ReviewSummary {
    return { token: this.token, covers: this.covers() };
  }
}
