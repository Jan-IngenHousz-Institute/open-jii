// A resources file lists the links a project carries under Resources in Linear:
//
//   ---
//   project: Notifications
//   ---
//
//   - [Notifications: project plan](https://uploads.linear.app/...)
//   - [Email sending quotas](https://docs.aws.amazon.com/ses/latest/dg/quotas.html)
//
// A link is matched by its URL, so relabelling one updates it instead of adding a second.
import { splitFrontMatter } from "./ticket-draft.js";

export interface DesiredResource {
  label: string;
  url: string;
}

export interface ResourceFile {
  project: string | null;
  resources: DesiredResource[];
}

export interface ProjectResource {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
}

export type ResourceAction =
  | { kind: "create"; label: string; url: string; sortOrder: number }
  | { kind: "update"; id: string; label: string; sortOrder: number; changes: string[] }
  | { kind: "keep"; label: string };

export interface ResourcePlan {
  actions: ResourceAction[];
  // On the project but not in the file. Nothing here deletes a link, so they stay.
  leftAlone: ProjectResource[];
}

const SORT_STEP = 1000;
const LINK_ITEM = /^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*$/;

export function parseResources(text: string): ResourceFile {
  const { meta, rest } = splitFrontMatter(text);
  const resources: DesiredResource[] = [];
  for (const line of rest.split("\n")) {
    if (line.trim().length === 0) continue;
    const match = LINK_ITEM.exec(line);
    if (!match) throw new Error(`Each line is "- [label](https url)": "${line.slice(0, 60)}"`);
    resources.push({ label: match[1].trim(), url: match[2] });
  }
  if (resources.length === 0) throw new Error("A resources file lists at least one link");

  const urls = resources.map((resource) => resource.url);
  const repeated = urls.find((url, index) => urls.indexOf(url) !== index);
  if (repeated !== undefined) throw new Error(`${repeated} is listed twice`);
  return { project: meta.project ?? null, resources };
}

export function planResources(
  desired: readonly DesiredResource[],
  existing: readonly ProjectResource[],
): ResourcePlan {
  const actions = desired.map((wanted, offset): ResourceAction => {
    const sortOrder = (offset + 1) * SORT_STEP;
    const current = existing.find((resource) => resource.url === wanted.url);
    if (current === undefined) {
      return { kind: "create", label: wanted.label, url: wanted.url, sortOrder };
    }

    const changes: string[] = [];
    if (current.label !== wanted.label) changes.push(`relabelled from "${current.label}"`);
    if (current.sortOrder !== sortOrder) changes.push("order");
    return changes.length === 0
      ? { kind: "keep", label: wanted.label }
      : { kind: "update", id: current.id, label: wanted.label, sortOrder, changes };
  });

  const wantedUrls = new Set(desired.map((resource) => resource.url));
  return { actions, leftAlone: existing.filter((resource) => !wantedUrls.has(resource.url)) };
}
