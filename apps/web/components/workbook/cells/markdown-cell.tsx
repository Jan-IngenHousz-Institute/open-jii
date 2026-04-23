"use client";

import { Edit3, Eye, FileText } from "lucide-react";
import { useCallback, useState } from "react";

import type { MarkdownCell as MarkdownCellType } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { RichTextarea } from "@repo/ui/components/rich-textarea";

import { CellWrapper } from "../cell-wrapper";

interface MarkdownCellProps {
  cell: MarkdownCellType;
  onUpdate: (cell: MarkdownCellType) => void;
  onDelete: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

export function MarkdownCellComponent({
  cell,
  onUpdate,
  onDelete,
  executionStatus,
  executionError,
  readOnly,
}: MarkdownCellProps) {
  const [isEditing, setIsEditing] = useState(!cell.content);

  const handleContentChange = useCallback(
    (content: string) => {
      onUpdate({ ...cell, content });
    },
    [cell, onUpdate],
  );

  const toggleMode = () => setIsEditing(!isEditing);

  return (
    <CellWrapper
      icon={<FileText className="h-3.5 w-3.5" />}
      label="Markdown"
      accentColor="#6F8596"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerActions={
        !readOnly ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 gap-1 px-2 text-xs"
            onClick={toggleMode}
          >
            {isEditing ? (
              <>
                <Eye className="h-3 w-3" /> Preview
              </>
            ) : (
              <>
                <Edit3 className="h-3 w-3" /> Edit
              </>
            )}
          </Button>
        ) : undefined
      }
    >
      {!readOnly && isEditing ? (
        <RichTextarea
          value={cell.content}
          onChange={handleContentChange}
          placeholder="Write something..."
        />
      ) : cell.content && cell.content !== "<p><br></p>" ? (
        <RichTextRenderer content={cell.content} />
      ) : (
        <p className="px-1 py-3 text-sm italic text-[#68737B]">
          {readOnly ? "No content" : "Click to add content..."}
        </p>
      )}
    </CellWrapper>
  );
}
