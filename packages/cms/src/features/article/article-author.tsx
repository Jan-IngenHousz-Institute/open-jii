"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { FC } from "react";

import type { PageBlogPostFieldsFragment } from "../../lib/__generated/sdk";
import { CtfImage } from "../contentful";

interface ArticleAuthorProps {
  article: PageBlogPostFieldsFragment;
}

export const ArticleAuthor: FC<ArticleAuthorProps> = ({ article }) => {
  const { author } = useContentfulLiveUpdates(article);
  const inspectorProps = useContentfulInspectorMode({
    entryId: author?.sys.id,
  });

  return (
    <div className="flex items-center">
      <div
        className="border-blue500 mr-2 overflow-hidden rounded-full border"
        {...inspectorProps({ fieldId: "avatar" })}
      >
        {author?.avatar && (
          <CtfImage
            nextImageProps={{
              width: 28,
              height: 28,
              sizes: undefined,
              placeholder: undefined,
            }}
            {...author.avatar}
          />
        )}
      </div>
      <span
        className="text-gray600 text-xs leading-none"
        {...inspectorProps({ fieldId: "name" })}
      >
        {author?.name}
      </span>
    </div>
  );
};
