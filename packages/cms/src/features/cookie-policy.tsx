"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import type { PageCookiePolicyFieldsFragment } from "../lib/__generated/sdk";
import type { EmbeddedEntryType } from "./contentful/ctf-rich-text";
import { CtfRichText } from "./contentful/ctf-rich-text";

interface CookiePolicyContentProps {
  cookiePolicy: PageCookiePolicyFieldsFragment;
  locale: string;
  preview: boolean;
}

export const CookiePolicyContent: React.FC<CookiePolicyContentProps> = ({
  cookiePolicy,
  locale,
  preview,
}) => {
  // Enable live updates only in preview mode using the correct options signature
  const liveCookiePolicy = useContentfulLiveUpdates<PageCookiePolicyFieldsFragment>(cookiePolicy, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentCookiePolicy = liveCookiePolicy || cookiePolicy;

  if (!currentCookiePolicy) return <div>No content found.</div>;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentCookiePolicy?.sys?.id,
    locale,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-20">
      <h1
        className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
        {...inspectorProps({ fieldId: "title" })}
      >
        {currentCookiePolicy.title}
      </h1>

      {/* Content */}
      {currentCookiePolicy.content?.json ? (
        <div className="mt-16" {...inspectorProps({ fieldId: "content" })}>
          <CtfRichText
            json={currentCookiePolicy.content.json as Document}
            links={
              currentCookiePolicy.content.links as {
                entries: {
                  block: EmbeddedEntryType[];
                };
              }
            }
          />
        </div>
      ) : null}
    </div>
  );
};
