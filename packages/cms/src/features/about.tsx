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
  preview: boolean;
}

export const AboutContent: React.FC<AboutContentProps> = ({ about, locale, preview }) => {
  // Enable live updates only in preview mode using the correct options signature
  const liveAbout = useContentfulLiveUpdates<PageAboutFieldsFragment>(about, {
    locale,
    skip: !preview,
  });

  // Use fallback to original data
  const currentAbout = liveAbout || about;

  if (!currentAbout) return <div>No content found.</div>;

  // Inspector mode tagging
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentAbout?.sys?.id,
    locale,
  });

  return (
    <div
      className={`flex w-full flex-col items-center gap-12 md:gap-16 ${
        !currentAbout.image?.url ? "md:flex-col" : "md:flex-row md:items-stretch"
      }`}
    >
      {/* Image */}
      {currentAbout.image?.url && (
        <div className="flex w-full items-stretch md:flex-1">
          <div
            className="group relative h-full w-full flex-1 overflow-hidden rounded-3xl shadow-2xl"
            {...inspectorProps({ fieldId: "image" })}
          >
            <Image
              src={currentAbout.image.url}
              alt={currentAbout.image.title || currentAbout.title || "About"}
              width={800}
              height={500}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent"></div>
          </div>
        </div>
      )}

      {/* Title + Rich Text */}
      <div
        className={`flex flex-col justify-center text-left ${
          currentAbout.image?.url ? "w-full md:flex-1" : "w-full"
        }`}
      >
        <h1
          className="text-jii-dark-green mb-8 text-5xl font-bold tracking-tight"
          {...inspectorProps({ fieldId: "title" })}
        >
          {currentAbout.title}
        </h1>
        {currentAbout.description?.json ? (
          <div
            className={`text-xl leading-relaxed text-gray-700 ${
              currentAbout.image?.url ? "" : "mx-0"
            }`}
            style={
              !currentAbout.image?.url ? { marginLeft: 0, marginRight: 0, textAlign: "left" } : {}
            }
            {...inspectorProps({ fieldId: "description" })}
          >
            {documentToReactComponents(currentAbout.description.json)}
          </div>
        ) : null}
      </div>
    </div>
  );
};
