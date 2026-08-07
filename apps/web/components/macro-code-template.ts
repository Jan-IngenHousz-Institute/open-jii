import type { CodeLanguage } from "~/components/shared/code-editor";

/**
 * Starter template offered when creating a macro. The `by:`/`created:` header lines are
 * only comments, so the returned string is safe to use as a real form value: whatever is
 * shown in the editor is what gets saved.
 */
export function getMacroCodeTemplate(language: CodeLanguage, username?: string): string {
  const date = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const author = username?.trim();

  switch (language) {
    case "python":
      return `# Macro for data evaluation on openjii.org
${author ? `# by: ${author}\n` : ""}# created: ${date}

# Define Output Dictionary (required)
output = {}

# Insert your macro code here

# Return Output Dictionary (required)
return output
`;
    case "r":
      return `# Macro for data evaluation on openjii.org
${author ? `# by: ${author}\n` : ""}# created: ${date}

# Define Output List (required)
output <- list()

# Insert your macro code here

# Return Output List (required)
output
`;
    case "javascript":
      return `/**
 * Macro for data evaluation on openjii.org
${author ? ` * by: ${author}\n` : ""} * created: ${date}
 */

// Define Output Object (required)
var output = {};

// Insert your macro code here

// Return Output Object (required)
return output;
`;
    default:
      return "";
  }
}
