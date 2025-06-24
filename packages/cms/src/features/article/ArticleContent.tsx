"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import type { FC } from "react";

import type { PageBlogPostFieldsFragment } from "../../lib/__generated/sdk";
import { CtfRichText } from "../contentful";
import type { EmbeddedEntryType } from "../contentful/CtfRichText";

interface ArticleContentProps {
  article: PageBlogPostFieldsFragment;
}

export const ArticleContent: FC<ArticleContentProps> = ({ article }) => {
  const { content } = useContentfulLiveUpdates(article) as {
    content: {
      json: Document;
      links: {
        entries: {
          block: EmbeddedEntryType[];
        };
      };
    };
  };
  const inspectorProps = useContentfulInspectorMode({
    entryId: article.sys.id,
  });

  return (
    <div {...inspectorProps({ fieldId: "content" })}>
      <CtfRichText json={content.json} links={content.links} />
    </div>
  );
};
