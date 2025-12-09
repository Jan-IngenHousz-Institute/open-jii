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
  noAvatar?: boolean;
}

export const ArticleAuthor: FC<ArticleAuthorProps> = ({ article, noAvatar = false }) => {
  const { author } = useContentfulLiveUpdates(article);
  const inspectorProps = useContentfulInspectorMode({
    entryId: author?.sys.id,
  });

  return (
    <div className="flex items-center">
      <div
        className={`${noAvatar ? "mr-0" : "mr-2"} overflow-hidden rounded-full`}
        {...inspectorProps({ fieldId: "avatar" })}
      >
        {author?.avatar && !noAvatar && (
          <CtfImage
            nextImageProps={{
              width: 52,
              height: 52,
              sizes: undefined,
              placeholder: undefined,
              className: "object-cover aspect-square",
            }}
            {...author.avatar}
          />
        )}
      </div>
      <span className="text-gray600 leading-none" {...inspectorProps({ fieldId: "name" })}>
        {author?.name}
      </span>
    </div>
  );
};
