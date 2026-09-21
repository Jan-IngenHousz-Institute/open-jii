import type { LinearClient } from "./linear.js";

export interface ProjectRef {
  id: string;
  name: string;
}

export interface ProjectDocument {
  id: string;
  title: string;
  url: string;
}

interface ProjectsResult {
  projects: { nodes: ProjectRef[] };
}

interface DocumentsResult {
  project: { documents: { nodes: ProjectDocument[] } };
}

const projectsQuery = `query($name: String!) {
  projects(first: 10, filter: { name: { containsIgnoreCase: $name } }) { nodes { id name } }
}`;
const documentsQuery = `query($id: String!) {
  project(id: $id) { documents(first: 50) { nodes { id title url } } }
}`;

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// A name, because that is what a person writes in a draft; it must match exactly one project.
export async function findProject(client: LinearClient, name: string): Promise<ProjectRef> {
  const result = await client.query<ProjectsResult>(projectsQuery, { name });
  const exact = result.projects.nodes.filter((project) => sameName(project.name, name));
  const project = exact.at(0);
  if (exact.length !== 1 || !project) {
    const candidates = result.projects.nodes.map((p) => `"${p.name}"`).join(", ") || "none";
    throw new Error(
      `Expected one project named "${name}", found ${exact.length}; close matches: ${candidates}`,
    );
  }
  return project;
}

export async function listProjectDocuments(
  client: LinearClient,
  projectId: string,
): Promise<ProjectDocument[]> {
  const result = await client.query<DocumentsResult>(documentsQuery, { id: projectId });
  return result.project.documents.nodes;
}
