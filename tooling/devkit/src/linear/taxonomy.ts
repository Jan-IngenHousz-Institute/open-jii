export type LabelPhase = "groups" | "creates" | "renames" | "merges" | "retires";

export const labelPhases: readonly LabelPhase[] = [
  "groups",
  "creates",
  "renames",
  "merges",
  "retires",
];

export interface LabelFacet {
  name: string;
  // Linear allows one label per group on an issue, so a facet whose values must combine stays flat.
  grouped: boolean;
}

export interface LabelRename {
  from: string;
  to: string;
  facet: string;
}

export interface LabelCreate {
  name: string;
  facet: string;
}

export interface LabelMerge {
  from: string;
  into: readonly string[];
}

export interface TaxonomySpec {
  teamKey: string;
  facets: readonly LabelFacet[];
  renames: readonly LabelRename[];
  creates: readonly LabelCreate[];
  merges: readonly LabelMerge[];
  retires: readonly string[];
  undecided: readonly string[];
  untouchablePrefixes: readonly string[];
}

// Mirrors the change list in docs/agents/linear-taxonomy.md. Edit both together.
export const taxonomy: TaxonomySpec = {
  teamKey: "OJD",
  facets: [
    { name: "type", grouped: true },
    { name: "area", grouped: false },
    { name: "triage", grouped: true },
    { name: "process", grouped: false },
  ],
  renames: [
    { from: "Bug", to: "bug", facet: "type" },
    { from: "enhancement", to: "feature", facet: "type" },
    { from: "Improvement", to: "improvement", facet: "type" },
    { from: "research", to: "spike", facet: "type" },
    { from: "Web", to: "web", facet: "area" },
    { from: "Mobile", to: "mobile", facet: "area" },
    { from: "Backend", to: "backend", facet: "area" },
    { from: "Data", to: "data", facet: "area" },
    { from: "ci/cd", to: "infra", facet: "area" },
    { from: "documentation", to: "docs", facet: "area" },
    { from: "design", to: "design", facet: "area" },
    { from: "needs_design", to: "needs-design", facet: "process" },
    { from: "Needs UX check", to: "needs-ux-check", facet: "process" },
    { from: "UX fix needed", to: "ux-fix-needed", facet: "process" },
    { from: "TestFindings", to: "test-findings", facet: "process" },
    { from: "ApprovedByTester", to: "approved-by-tester", facet: "process" },
    { from: "Blocked - External", to: "blocked-external", facet: "process" },
    { from: "help wanted", to: "help-wanted", facet: "process" },
  ],
  creates: [
    { name: "chore", facet: "type" },
    { name: "needs-triage", facet: "triage" },
    { name: "needs-info", facet: "triage" },
    { name: "ready-for-agent", facet: "triage" },
    { name: "ready-for-human", facet: "triage" },
    { name: "wontfix", facet: "triage" },
  ],
  merges: [
    { from: "Feature", into: ["feature"] },
    { from: "python", into: ["data"] },
    { from: "python:uv", into: ["data"] },
    { from: "Devops testing", into: ["infra"] },
    { from: "Fullstack", into: ["web", "backend"] },
  ],
  retires: [
    "Blog",
    "Case Study",
    "Event",
    "Newsletter",
    "Social",
    "Whitepaper",
    "Changelog",
    "question",
    "Ignored_by_Romy",
    "Most Urgent",
    "Roughly_estimated",
    "to_Refine",
    "Migrated",
    "Epic",
  ],
  undecided: ["Platform", "Proposal", "planning"],
  untouchablePrefixes: ["WBSO", "No-WBSO", "wayfinder:"],
};
