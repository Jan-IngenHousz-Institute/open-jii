"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { Globe } from "lucide-react";
import Image from "next/image";
import React from "react";

import type { PageHomeMissionFieldsFragment } from "../../lib/__generated/sdk";

interface HomeAboutMissionProps {
  missionData: PageHomeMissionFieldsFragment;
  preview?: boolean;
  locale?: string;
}

export const HomeAboutMission: React.FC<HomeAboutMissionProps> = ({
  missionData,
  preview = false,
  locale,
}) => {
  // Enable live updates only in preview mode
  const liveMission = useContentfulLiveUpdates<PageHomeMissionFieldsFragment>(missionData, {
    skip: !preview,
    ...(locale ? { locale } : {}),
  });
  const currentMission = liveMission || missionData;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentMission?.sys?.id,
    ...(locale ? { locale } : {}),
  });
  if (!currentMission) return null;
  return (
    <section className="mx-auto mt-16 flex w-full max-w-7xl flex-col items-center gap-12 rounded-3xl border border-white/20 bg-white/60 p-12 shadow-2xl backdrop-blur-sm md:flex-row md:items-stretch md:gap-16">
      <div className="flex-1 text-center md:text-left">
        <h2
          className="from-jii-medium-green to-jii-dark-green mb-6 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent"
          {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
        >
          {currentMission.title}
        </h2>
        {currentMission.about?.json ? (
          <div
            className="mb-8 text-lg leading-relaxed text-gray-600"
            {...(preview ? inspectorProps({ fieldId: "about" }) : {})}
          >
            {documentToReactComponents(currentMission.about.json)}
          </div>
        ) : null}
        <div className="rounded-2xl border-l-4 border-emerald-400 bg-gradient-to-r from-emerald-50 to-blue-50 p-8">
          <h3
            className="mb-4 flex items-center space-x-2 text-2xl font-bold text-emerald-700"
            {...(preview ? inspectorProps({ fieldId: "subtitle" }) : {})}
          >
            <Globe className="h-6 w-6" />
            <span>{currentMission.subtitle}</span>
          </h3>
          {currentMission.mission?.json ? (
            <p
              className="font-medium leading-relaxed text-gray-700"
              {...(preview ? inspectorProps({ fieldId: "mission" }) : {})}
            >
              {documentToReactComponents(currentMission.mission.json)}
            </p>
          ) : null}
        </div>
      </div>
      {/* Image section only if image exists */}
      {currentMission.image?.url && (
        <div className="w-full md:flex-1">
          <div className="group relative h-full overflow-hidden rounded-2xl">
            <div
              className="h-full w-full"
              {...(preview ? inspectorProps({ fieldId: "image" }) : {})}
            >
              <Image
                src={currentMission.image.url}
                alt={currentMission.image.title || "Scientific research and collaboration"}
                width={600}
                height={400}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent"></div>
          </div>
        </div>
      )}
    </section>
  );
};
