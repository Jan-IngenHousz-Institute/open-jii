"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import Image from "next/image";
import React from "react";

import type { PageAboutFieldsFragment } from "../lib/__generated/sdk";
import { CtfRichText } from "./contentful/ctf-rich-text";

interface AboutContentProps {
  about: PageAboutFieldsFragment;
  locale: string;
  preview: boolean;
}

export const AboutContent: React.FC<AboutContentProps> = ({ about, locale, preview }) => {
  const liveAbout = useContentfulLiveUpdates<PageAboutFieldsFragment>(about, {
    locale,
    skip: !preview,
  });

  const currentAbout = liveAbout || about;

  if (!currentAbout) return <div>No content found.</div>;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentAbout?.sys?.id,
    locale,
  });

  return (
    <div className="from-jii-bright-green/40 relative isolate overflow-hidden bg-gradient-to-br via-white to-white pb-6">
      {/* Top fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-4 bg-gradient-to-b from-white to-transparent" />

      {/* Background skew block */}
      <div
        aria-hidden="true"
        className="shadow-primary/10 ring-jii-bright-green/20 absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl ring-1 sm:-mr-80 lg:-mr-96"
      />

      {/* Middle container */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-x-10 lg:gap-y-6 xl:grid-cols-1 xl:grid-rows-1 xl:gap-x-8">
          {/* TITLE */}
          <h1
            className="max-w-2xl pr-10 text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
            {...inspectorProps({ fieldId: "title" })}
          >
            {currentAbout.title}
          </h1>

          {/* DESCRIPTION */}
          <div className="mt-4 max-w-xl lg:mt-0 xl:col-end-1 xl:row-start-1">
            {currentAbout.description?.json && (
              <div className="text-base sm:text-lg" {...inspectorProps({ fieldId: "description" })}>
                <CtfRichText json={currentAbout.description.json as Document} />
              </div>
            )}
          </div>

          {/* IMAGE */}
          {currentAbout.image?.url && (
            <div className="mt-10 xl:row-span-2 xl:row-end-2 xl:mt-20">
              <div
                className="relative h-[550px] w-full max-w-3xl overflow-hidden rounded-2xl outline outline-1 outline-black/5"
                {...inspectorProps({ fieldId: "image" })}
              >
                <Image
                  src={currentAbout.image.url}
                  alt={currentAbout.image.title ?? currentAbout.title ?? "About"}
                  width={1600}
                  height={1200}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
