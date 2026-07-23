import type { InventoryReport, ReferenceFinding } from "./types.js";

function location(finding: ReferenceFinding): string {
  return finding.line === 0
    ? `${finding.path} (path)`
    : `${finding.path}:${finding.line}:${finding.column}`;
}

export function serializeReport(report: InventoryReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function exitCodeForMode(report: InventoryReport, mode: "report" | "strict"): 0 | 1 {
  return mode === "strict" && report.summary.nomenclatureIssues > 0 ? 1 : 0;
}

export function renderConsoleReport(report: InventoryReport): string {
  const lines = [
    "Device nomenclature inventory",
    `Tracked files: ${report.trackedFileCount} (${report.scannedTextFileCount} text)`,
    `References: ${report.summary.totalReferences} (${report.summary.classified} classified, ${report.summary.nomenclatureIssues} issues)`,
    "",
    "By surface:",
    ...Object.entries(report.countsBySurface).map(([name, count]) => `  ${name}: ${count}`),
    "",
    "By category:",
    ...Object.entries(report.countsByCategory).map(([name, count]) => `  ${name}: ${count}`),
  ];

  const issues = report.findings.filter((finding) => finding.status !== "classified");
  if (issues.length > 0 || report.deadRules.length > 0) {
    lines.push("", "Actionable findings:");
    for (const finding of issues) {
      const rules = finding.ruleIds.length > 0 ? ` [${finding.ruleIds.join(", ")}]` : "";
      lines.push(`  ${finding.status}: ${location(finding)} "${finding.token}"${rules}`);
    }
    for (const deadRule of report.deadRules) {
      lines.push(`  dead-rule: ${deadRule.ruleId} (${deadRule.reason})`);
    }
  }
  return `${lines.join("\n")}\n`;
}
