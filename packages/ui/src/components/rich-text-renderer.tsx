"use client";

import "quill/dist/quill.snow.css";
import React from "react";

interface RichTextRendererProps {
  content: string;
}

export function RichTextRenderer({ content }: RichTextRendererProps) {
  // Use a safe regex to check for HTML tags
  const isRichText = /<[^>]+>/.test(content);

  if (!content || content === "<p><br></p>") {
    return <p className="text-muted-foreground text-sm italic">No description provided</p>;
  }

  if (!isRichText) {
    return <p className="text-sm">{content}</p>;
  }

  return (
    <>
      <div className="ql-editor rich-text-renderer" dangerouslySetInnerHTML={{ __html: content }} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .rich-text-renderer {
            padding: 8px 0;
            border: none;
            font-size: inherit;
            line-height: 1.5;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            min-width: 0;
          }

          .rich-text-renderer h1 {
            font-size: 1.5em;
            font-weight: 600;
            margin: 0.5em 0;
          }

          .rich-text-renderer h2 {
            font-size: 1.25em;
            font-weight: 600;
            margin: 0.5em 0;
          }

          .rich-text-renderer h3 {
            font-size: 1.1em;
            font-weight: 600;
            margin: 0.5em 0;
          }

          .rich-text-renderer strong {
            font-weight: bold;
          }

          .rich-text-renderer em {
            font-style: italic;
          }

          .rich-text-renderer u {
            text-decoration: underline;
          }

          .rich-text-renderer ol,
          .rich-text-renderer ul {
            margin-left: 1.2em;
            padding-left: 0;
          }

          .rich-text-renderer li {
            margin: 0.3em 0;
            padding-left: 0.3em;
          }

          .rich-text-renderer a {
            color: #3b82f6;
            text-decoration: underline;
          }

          .rich-text-renderer a:hover {
            color: #1d4ed8;
          }

          .rich-text-renderer code {
            background-color: #f3f4f6;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            font-size: 0.9em;
            color: black;
          }

          .rich-text-renderer pre {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px;
            margin: 8px 0;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.4;
          }

          .rich-text-renderer blockquote {
            border-left: 3px solid #d1d5db;
            margin: 12px 0;
            padding: 8px 12px;
            color: #6b7280;
            font-style: italic;
            background-color: #f9fafb;
            border-radius: 0 4px 4px 0;
          }

          .rich-text-renderer p {
            margin: 0.4em 0;
          }

          .rich-text-renderer p:first-child {
            margin-top: 0;
          }

          .rich-text-renderer p:last-child {
            margin-bottom: 0;
          }
        `,
        }}
      />
    </>
  );
}
