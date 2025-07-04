"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import Image from "next/image";
import React from "react";

import type { PageAboutFieldsFragment } from "../lib/__generated/sdk";

interface AboutContentProps {
  about: PageAboutFieldsFragment;
  locale: string;
  preview?: boolean;
}

export const AboutContent: React.FC<AboutContentProps> = ({ about, locale, preview = false }) => {
  // Enable live updates only in preview mode using the correct options signature
  const liveAbout = useContentfulLiveUpdates<PageAboutFieldsFragment>(about, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentAbout = liveAbout || about;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: about?.sys?.id,
    locale,
  });

  if (!currentAbout) return <div>No content found.</div>;

  return (
    <div
      className={`flex w-full max-w-7xl flex-col items-center gap-12 md:gap-16 ${
        !currentAbout.image?.url ? "md:flex-col" : "md:flex-row md:items-center"
      }`}
    >
      {/* Image */}
      {currentAbout.image?.url && (
        <div className="w-full md:w-1/2">
          <div className="overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src={currentAbout.image.url}
              alt={currentAbout.image.title || currentAbout.title || "About"}
              width={800}
              height={500}
              className="w-full object-cover"
              priority
              {...(preview ? inspectorProps({ fieldId: "image" }) : {})}
            />
          </div>
        </div>
      )}

      {/* Title + Rich Text */}
      <div
        className={`flex w-full flex-col justify-center text-left ${
          currentAbout.image?.url ? "md:w-1/2" : "md:w-full"
        }`}
      >
        <h1
          className="text-jii-dark-green mb-8 text-5xl font-bold tracking-tight"
          {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
        >
          {currentAbout.title}
        </h1>
        {currentAbout.description?.json ? (
          <div
            className={`max-w-3xl text-xl leading-relaxed text-gray-700 ${
              currentAbout.image?.url ? "" : "mx-0"
            }`}
            style={
              !currentAbout.image?.url ? { marginLeft: 0, marginRight: 0, textAlign: "left" } : {}
            }
            {...(preview ? inspectorProps({ fieldId: "description" }) : {})}
          >
            {documentToReactComponents(currentAbout.description.json)}
          </div>
        ) : null}
      </div>
    </div>
  );
};
