import type { Options } from "@contentful/rich-text-react-renderer";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document, Node } from "@contentful/rich-text-types";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import React from "react";

interface EmbeddedButton {
  __typename: "ComponentButton";
  label?: string | null;
  url?: string | null;
  sys: { id: string };
}

type EmbeddedEntry = EmbeddedButton | { __typename: string; sys: { id: string } };

export interface EmailRichTextInterface {
  json: Document;
  links?: {
    entries: {
      block: (EmbeddedEntry | null)[];
    };
  };
}

const emailRichTextOptions = (links?: EmailRichTextInterface["links"]): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => <strong className="font-semibold">{text}</strong>,
    [MARKS.ITALIC]: (text) => <em className="italic">{text}</em>,
    [MARKS.UNDERLINE]: (text) => <u className="underline">{text}</u>,
  },
  renderNode: {
    [BLOCKS.HEADING_1]: (_node: Node, children: React.ReactNode) => (
      <h1 className="my-8 text-4xl font-bold">{children}</h1>
    ),
    [BLOCKS.HEADING_2]: (_node: Node, children: React.ReactNode) => (
      <h2 className="my-6 text-3xl font-semibold">{children}</h2>
    ),
    [BLOCKS.HEADING_3]: (_node: Node, children: React.ReactNode) => (
      <h3 className="my-5 text-2xl font-semibold">{children}</h3>
    ),
    [BLOCKS.HEADING_4]: (_node: Node, children: React.ReactNode) => (
      <h4 className="my-4 text-xl font-semibold">{children}</h4>
    ),
    [BLOCKS.HEADING_5]: (_node: Node, children: React.ReactNode) => (
      <h5 className="my-3 text-lg font-semibold">{children}</h5>
    ),
    [BLOCKS.HEADING_6]: (_node: Node, children: React.ReactNode) => (
      <h6 className="my-2 text-base font-semibold">{children}</h6>
    ),
    [BLOCKS.PARAGRAPH]: (_node: Node, children: React.ReactNode) => (
      <p className="my-4 leading-5 last:mb-0">{children}</p>
    ),
    [BLOCKS.UL_LIST]: (_node: Node, children: React.ReactNode) => (
      <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>
    ),
    [BLOCKS.OL_LIST]: (_node: Node, children: React.ReactNode) => (
      <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Node, children: React.ReactNode) => (
      <li className="leading-relaxed [&>p]:my-0">{children}</li>
    ),
    [BLOCKS.QUOTE]: (_node: Node, children: React.ReactNode) => (
      <blockquote
        style={{
          margin: "2rem 0",
          paddingLeft: "1rem",
          borderLeft: "4px solid #d1d5db",
          color: "#6b7280",
          fontStyle: "italic",
        }}
      >
        {children}
      </blockquote>
    ),
    [BLOCKS.HR]: () => <hr className="my-6 border-t border-gray-200/20" />,
    [BLOCKS.TABLE]: (_node: Node, children: React.ReactNode) => (
      <div className="my-6 min-w-full overflow-x-auto">
        <table
          cellPadding={0}
          cellSpacing={0}
          style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}
        >
          <tbody>{children}</tbody>
        </table>
      </div>
    ),
    [BLOCKS.TABLE_ROW]: (_node: Node, children: React.ReactNode) => <tr>{children}</tr>,
    [BLOCKS.TABLE_HEADER_CELL]: (_node: Node, children: React.ReactNode) => (
      <th
        style={{
          border: "1px solid #d1d5db",
          padding: "0.5rem 1rem",
          textAlign: "left",
          fontWeight: "600",
          backgroundColor: "#f3f4f6",
        }}
      >
        {children}
      </th>
    ),
    [BLOCKS.TABLE_CELL]: (_node: Node, children: React.ReactNode) => (
      <td style={{ border: "1px solid #d1d5db", padding: "0.5rem 1rem" }}>{children}</td>
    ),
    [BLOCKS.EMBEDDED_ENTRY]: (node: Node) => {
      const targetId = (node.data as { target?: { sys?: { id?: string } } }).target?.sys?.id;
      const entry = links?.entries.block.find((item) => item?.sys.id === targetId);
      if (!entry) return null;
      if (entry.__typename === "ComponentButton") {
        const button = entry as EmbeddedButton;
        return (
          <div className="my-6 text-center">
            <a
              href={button.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-[#005E5E] px-6 py-3 font-semibold text-white no-underline"
            >
              {button.label}
            </a>
          </div>
        );
      }
      return null;
    },
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string }).uri ?? "#";
      return (
        <a
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#005E5E] hover:underline"
        >
          {children}
        </a>
      );
    },
  },
});

export const EmailRichText = ({ json, links }: EmailRichTextInterface) => {
  return (
    <div className="rounded-t-xl bg-white px-8 py-1">
      {documentToReactComponents(json, emailRichTextOptions(links))}
    </div>
  );
};
