/**
 * Slack Block Kit.
 *
 * A webhook accepts either a `text` string or a `blocks` array. Every message here
 * carries both, so the notification preview and any client that cannot render blocks
 * still say something useful, and the composer has something to log when no webhook is
 * configured.
 */

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackMessage {
  /** Notification preview, and what the composer logs when no webhook is set. */
  text: string;
  blocks: SlackBlock[];
}

export interface LinkButton {
  label: string;
  url: string;
}

export function header(text: string): SlackBlock {
  // plain_text only, and Slack truncates past 150 characters.
  return { type: "header", text: { type: "plain_text", text: text.slice(0, 150) } };
}

export function context(text: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

export function divider(): SlackBlock {
  return { type: "divider" };
}

export function section(text: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text } };
}

export function image(url: string, altText: string): SlackBlock {
  return { type: "image", image_url: url, alt_text: altText };
}

export function actions(buttons: LinkButton[]): SlackBlock {
  return {
    type: "actions",
    elements: buttons.slice(0, 5).map((button) => ({
      type: "button",
      text: { type: "plain_text", text: button.label },
      url: button.url,
    })),
  };
}

/**
 * Columns only line up inside a code block, so a table is preformatted text.
 *
 * Rows arrive as cells already rendered; this pads them, which is the only thing that
 * makes a list of figures scannable rather than a paragraph of numbers.
 */
// A section's text is capped at 3000 characters, and Slack rejects the whole message past it.
const SECTION_TEXT_LIMIT = 2900;

export function table(rows: string[][]): string {
  if (rows.length === 0) {
    return "";
  }

  return renderTable(rows, columnWidths(rows));
}

// A row of one cell is a heading. It spans the table, so letting it set a column width
// would push every figure sideways to clear a word above them.
function columnWidths(rows: string[][]): number[] {
  const data = rows.filter((row) => row.length > 1);
  const columns = Math.max(1, ...data.map((row) => row.length));

  return Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...data.map((row) => (row[column] ?? "").length)),
  );
}

function renderTable(rows: string[][], widths: number[]): string {
  const body = rows
    .map((row) =>
      row
        .map((cell, column) =>
          // The last column is not padded, so no line carries trailing space.
          column === widths.length - 1 ? cell : cell.padEnd(widths[column]),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");

  return `\`\`\`\n${body}\n\`\`\``;
}

/**
 * The table as one section per chunk that fits Slack's limit, so a long list splits rather
 * than being rejected. Columns are measured across all rows first, so the chunks line up.
 */
export function tableSections(rows: string[][]): SlackBlock[] {
  if (rows.length === 0) {
    return [];
  }

  const widths = columnWidths(rows);
  const sections: SlackBlock[] = [];
  let chunk: string[][] = [];

  for (const row of rows) {
    const candidate = [...chunk, row];
    if (chunk.length > 0 && renderTable(candidate, widths).length > SECTION_TEXT_LIMIT) {
      sections.push(section(renderTable(chunk, widths)));
      chunk = [];
    }
    chunk.push(row);
  }
  sections.push(section(renderTable(chunk, widths)));

  return sections;
}
