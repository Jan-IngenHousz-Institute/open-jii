import type { Options } from "@contentful/rich-text-react-renderer";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document, Node } from "@contentful/rich-text-types";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";
import Link from "next/link";
import React from "react";

import type { ComponentRichImage } from "../../lib/__generated/sdk";
import { ArticleImage } from "../article";

// ---- Types ---- //
export type EmbeddedEntryType = ComponentRichImage | null;

export interface ContentfulRichTextInterface {
  json: Document;
  links?: {
    entries: {
      block: EmbeddedEntryType[];
    };
  };
}

// ---- Embedded Entry Renderer ---- //
export const EmbeddedEntry = (entry: EmbeddedEntryType) => {
  switch (entry?.__typename) {
    case "ComponentRichImage":
      return <ArticleImage image={entry} />;
    default:
      return null;
  }
};

// ---- Base Rich Text Options ---- //
export const contentfulBaseRichTextOptions = ({ links }: ContentfulRichTextInterface): Options => ({
  renderMark: {
    [MARKS.BOLD]: (text) => <strong className="font-semibold">{text}</strong>,
    [MARKS.ITALIC]: (text) => <em className="italic">{text}</em>,
    [MARKS.UNDERLINE]: (text) => <u className="underline">{text}</u>,
  },
  renderNode: {
    // Headings
    [BLOCKS.HEADING_1]: (node: Node, children: React.ReactNode) => (
      <h1 className="my-8 text-4xl font-bold">{children}</h1>
    ),
    [BLOCKS.HEADING_2]: (node: Node, children: React.ReactNode) => (
      <h2 className="my-6 text-3xl font-semibold">{children}</h2>
    ),
    [BLOCKS.HEADING_3]: (node: Node, children: React.ReactNode) => (
      <h3 className="my-5 text-2xl font-semibold">{children}</h3>
    ),
    [BLOCKS.HEADING_4]: (node: Node, children: React.ReactNode) => (
      <h4 className="my-4 text-xl font-semibold">{children}</h4>
    ),
    [BLOCKS.HEADING_5]: (node: Node, children: React.ReactNode) => (
      <h5 className="my-3 text-lg font-semibold">{children}</h5>
    ),
    [BLOCKS.HEADING_6]: (node: Node, children: React.ReactNode) => (
      <h6 className="my-2 text-base font-semibold">{children}</h6>
    ),

    // Paragraphs
    [BLOCKS.PARAGRAPH]: (node: Node, children: React.ReactNode) => (
      <p className="my-4 last:mb-0">{children}</p>
    ),

    // Lists (reduced outer margin, consistent inner spacing)
    [BLOCKS.UL_LIST]: (node: Node, children: React.ReactNode) => (
      <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>
    ),
    [BLOCKS.OL_LIST]: (node: Node, children: React.ReactNode) => (
      <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>
    ),

    [BLOCKS.LIST_ITEM]: (node: Node, children: React.ReactNode) => (
      <li className="leading-relaxed [&>p]:my-0">{children}</li>
    ),

    // Blockquote
    [BLOCKS.QUOTE]: (node: Node, children: React.ReactNode) => (
      <blockquote className="my-8 border-l-4 border-gray-300/70 pl-6">{children}</blockquote>
    ),

    // Tables
    [BLOCKS.TABLE]: (node: Node, children: React.ReactNode) => (
      <div className="-mx-4 my-6 min-w-full overflow-x-auto sm:-mx-0">
        <table className="w-full table-fixed border-collapse border border-gray-300">
          <tbody>{children}</tbody>
        </table>
      </div>
    ),
    [BLOCKS.TABLE_ROW]: (node: Node, children: React.ReactNode) => <tr>{children}</tr>,
    [BLOCKS.TABLE_HEADER_CELL]: (node: Node, children: React.ReactNode) => (
      <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold">
        {children}
      </th>
    ),
    [BLOCKS.TABLE_CELL]: (node: Node, children: React.ReactNode) => (
      <td className="border border-gray-300 px-4 py-2">{children}</td>
    ),

    // Inline hyperlinks
    [INLINES.HYPERLINK]: (node: Node, children: React.ReactNode) => {
      const uri = (node.data as { uri?: string })?.uri ?? "#";
      return (
        <Link
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {children}
        </Link>
      );
    },

    // Embedded entries (images, etc.)
    [BLOCKS.EMBEDDED_ENTRY]: (node: Node) => {
      const targetId = (node.data as { target?: { sys?: { id?: string } } })?.target?.sys?.id;
      const entry = links?.entries.block.find(
        (item: EmbeddedEntryType) => item?.sys.id === targetId,
      );
      if (!entry) return null;
      return <EmbeddedEntry {...entry} />;
    },
  },
});

// ---- Rich Text Component ---- //
export const CtfRichText = ({ json, links }: ContentfulRichTextInterface) => {
  const baseOptions = contentfulBaseRichTextOptions({ json, links });

  return (
    <div className="w-full break-words leading-relaxed text-gray-900">
      {documentToReactComponents(json, baseOptions)}
    </div>
  );
};
