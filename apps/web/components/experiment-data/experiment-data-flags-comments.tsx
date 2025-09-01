import { Flag, MessageSquare, Trash2 } from "lucide-react";
import React from "react";

import type { ExperimentDataComment, ExperimentDataCommentFlag } from "@repo/api";
import { Badge, Button, HoverCard, HoverCardContent, HoverCardTrigger } from "@repo/ui/components";

export function Flags({ flags }: { flags: ExperimentDataCommentFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <>
      {flags.map((flag) => (
        <Badge variant="outline" className="px-1">
          <Flag size={12} className="mr-2" /> {flag}
        </Badge>
      ))}
    </>
  );
}

export function CommentsBadge({ count }: { count: number }) {
  if (count == 0) return null;
  return (
    <Badge variant="outline" className="px-1">
      <MessageSquare size={12} className="mr-2" /> {count}
    </Badge>
  );
}

export function RenderCommentsAndFlags({ commentsJSON }: { commentsJSON: string }) {
  const parsedCommentsAndFlags = JSON.parse(commentsJSON) as ExperimentDataComment[];
  const comments: ExperimentDataComment[] = parsedCommentsAndFlags.filter(
    (comment) => comment.flag === undefined,
  );
  const flagComments: ExperimentDataComment[] = parsedCommentsAndFlags.filter(
    (comment) => comment.flag !== undefined,
  );
  const uniqueFlags: ExperimentDataCommentFlag[] = Array.from(
    new Set(
      flagComments
        .map((comment) => comment.flag)
        .filter((flag) => flag !== undefined)
        .flat(),
    ),
  );
  return (
    <HoverCard>
      <HoverCardTrigger>
        <div className="flex w-full flex-wrap gap-2">
          <CommentsBadge count={comments.length} />
          <Flags flags={uniqueFlags} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="">
          <div className="">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Comments & Flags</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {flagComments.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-600">FLAGS</h4>
              {flagComments.map((comment) => {
                return (
                  <div className="mt-4">
                    <Badge variant="outline" className="px-1">
                      <Flag size={12} className="mr-2" /> {comment.flag}
                    </Badge>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Mike Johnson</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">25/07/2025 11:15</span>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-gray-700">{comment.text}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {comments.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-600">COMMENTS</h4>
              {comments.map((comment) => {
                return (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Mike Johnson</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">25/07/2025 11:15</span>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
