"use client";

import { useQuill } from "react-quilljs";
import 'quill/dist/quill.snow.css';
import React from "react";

export function RichTextarea({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder?: string }) {
  const { quill, quillRef } = useQuill({
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ header: [1, 2, 3, false] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['code'],
        ['blockquote'],
        ['clean'],
      ],
    },
    formats: [
      'header', 'bold', 'italic', 'underline',
      'list', 'link', 'code', 'code-block', 'blockquote'
    ],
    placeholder: placeholder ?? 'Write something awesome...',
  });

  React.useEffect(() => {
    if (quill) {
      // Set initial value if provided
      if (value && quill.root.innerHTML !== value) {
        quill.root.innerHTML = value;
      }

      const handleTextChange = () => {
        const html = quill.root.innerHTML;
        if (html !== value) {
          onChange(html);
        }
      };

      quill.on('text-change', handleTextChange);

      // Cleanup
      return () => {
        quill.off('text-change', handleTextChange);
      };
    }
  }, [quill, onChange, value]);

  return (
    <div className="border-input focus-visible:ring-ring flex flex-col w-full rounded-md border bg-transparent text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">
      <div
        ref={quillRef}
        className="w-full min-h-[300px] max-h-[300px] overflow-hidden"
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      />
      <style>
        {`
          .ql-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: none;
          }
          .ql-toolbar {
            border-bottom: 1px solid #ccc;
            border-top: none;
            border-left: none;
            border-right: none;
          }
          .ql-editor {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 12px;
            word-break: break-word;
            white-space: pre-wrap;
            border: none;
          }
          .ql-editor blockquote {
            border-left: 4px solid #ccc;
            margin-bottom: 5px;
            margin-top: 5px;
            padding-left: 16px;
            font-style: italic;
          }
          .ql-editor code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          }
          .ql-editor pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        `}
      </style>
    </div>
  );
}