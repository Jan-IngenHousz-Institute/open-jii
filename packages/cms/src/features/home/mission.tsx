"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import React from "react";

import type { PageHomeMissionFieldsFragment } from "../../lib/__generated/sdk";
import { CtfImage } from "../contentful/ctf-image";
import { CtfRichText } from "../contentful/ctf-rich-text";
import type { EmbeddedEntryType } from "../contentful/ctf-rich-text";

interface HomeAboutMissionProps {
  missionData: PageHomeMissionFieldsFragment;
  preview: boolean;
  locale: string;
}

export const HomeAboutMission: React.FC<HomeAboutMissionProps> = ({
  missionData,
  preview,
  locale,
}) => {
  // Enable live updates only in preview mode
  const liveMission = useContentfulLiveUpdates<PageHomeMissionFieldsFragment>(missionData, {
    skip: !preview,
    locale,
  });
  const currentMission = liveMission ?? missionData;

  if (!currentMission) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentMission?.sys?.id,
    locale,
  });

  const images = currentMission.imagesCollection?.items?.filter((img) => !!img?.url) ?? [];

  return (
    <div className="py-16">
      <div className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8">
        {/* --- TOP TITLE SECTION --- */}
        <div className="max-w-4xl">
          <h1
            className="text-foreground mt-2 text-pretty text-4xl font-semibold tracking-tight sm:text-5xl"
            {...inspectorProps({ fieldId: "subtitle" })}
          >
            {currentMission.subtitle}
          </h1>

          {currentMission.mission?.json && (
            <div
              className="text-foreground mt-6 text-xl leading-8"
              {...inspectorProps({ fieldId: "mission" })}
            >
              <CtfRichText
                json={currentMission.mission.json as Document}
                links={
                  currentMission.mission.links as {
                    entries: { block: EmbeddedEntryType[] };
                  }
                }
              />
            </div>
          )}
        </div>

        {/* --- GRID SECTION (TEXT + IMAGES) --- */}
        <section className="mt-20 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-16">
          {/* --- LEFT COLUMN: SUBTITLE + MISSION --- */}
          <div className="lg:pr-8">
            <h2
              className="text-foreground text-pretty text-3xl font-semibold tracking-tight"
              {...inspectorProps({ fieldId: "title" })}
            >
              {currentMission.title}
            </h2>

            {currentMission.about?.json && (
              <div
                className="text-muted-foreground mt-6 text-lg leading-7"
                {...inspectorProps({ fieldId: "about" })}
              >
                <CtfRichText
                  json={currentMission.about.json as Document}
                  imageClassName="-mb-2"
                  links={
                    currentMission.about.links as {
                      entries: {
                        block: EmbeddedEntryType[];
                      };
                    }
                  }
                />
              </div>
            )}
          </div>

          {/* --- RIGHT COLUMN: IMAGE GRID --- */}
          <div className="overflow-hidden pt-16 lg:row-span-2 lg:-mr-16 lg:overflow-visible xl:mr-auto">
            <div
              className="-mx-8 grid grid-cols-2 gap-4 sm:-mx-16 sm:grid-cols-4 lg:mx-0 lg:grid-cols-2 xl:gap-8"
              {...inspectorProps({ fieldId: "images" })}
            >
              {images.map((img, index) => (
                <div
                  key={img?.sys.id}
                  className={`outline-border aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 ${index % 2 === 1 ? "-mt-8 lg:-mt-40" : ""} `}
                >
                  {img && (
                    <CtfImage
                      {...img}
                      nextImageProps={{
                        className: "block h-full w-full object-cover",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
