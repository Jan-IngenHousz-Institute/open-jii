import { plainTextSelectors } from "@react-email/components";
import React from "react";

const SEPARATOR = " — ";

/**
 * The plain-text pass flattens layout tables, which would run each name into its reason, so
 * an email holding a panel renders it as a data table there: one line per row.
 */
export const linesPanelHtmlToTextOptions = {
  selectors: [
    ...(plainTextSelectors as { selector: string; format?: string; options?: object }[]),
    { selector: "table.lines-panel", format: "dataTable" },
  ],
};

const BORDER = "1px solid #e5e7eb";

const cell: React.CSSProperties = { padding: "7px 14px", fontSize: "14px", lineHeight: "20px" };

/**
 * Lines of the form "name — reason" as a panel of rows, the name in monospace on the left and
 * the reason on the right; a line without the separator is a muted row at the bottom. A table
 * with inline styles, since mail clients drop classes and flex layouts.
 */
export const LinesPanel = ({ lines }: { lines: string[] }) => {
  const pairs = lines.filter((line) => line.includes(SEPARATOR));
  const notes = lines.filter((line) => !line.includes(SEPARATOR));

  return (
    <table
      className="lines-panel"
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        backgroundColor: "#f9fafb",
        border: BORDER,
        borderRadius: "8px",
        margin: "14px 0",
      }}
    >
      <tbody>
        {pairs.map((line, index) => {
          const [name, ...reason] = line.split(SEPARATOR);
          const divider = index === 0 ? {} : { borderTop: BORDER };
          return (
            <tr key={index}>
              <td
                style={{
                  ...cell,
                  ...divider,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "13.5px",
                  color: "#111827",
                  textAlign: "left",
                  wordBreak: "break-all",
                }}
              >
                {name}
              </td>
              <td
                style={{
                  ...cell,
                  ...divider,
                  color: "#4b5563",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {reason.join(SEPARATOR)}
              </td>
            </tr>
          );
        })}
        {notes.map((line, index) => (
          <tr key={`note-${index}`}>
            <td
              colSpan={2}
              style={{
                ...cell,
                ...(pairs.length + index === 0 ? {} : { borderTop: BORDER }),
                color: "#4b5563",
                textAlign: "left",
              }}
            >
              {line}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
