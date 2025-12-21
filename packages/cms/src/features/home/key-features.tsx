"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import Image from "next/image";
import React from "react";

import type { PageHomeFeaturesFieldsFragment } from "../../lib/__generated/sdk";

interface HomeKeyFeaturesProps {
  featuresData: PageHomeFeaturesFieldsFragment;
  preview: boolean;
  locale: string;
}

export const HomeKeyFeatures: React.FC<HomeKeyFeaturesProps> = ({
  featuresData,
  preview,
  locale,
}) => {
  const liveFeatures = useContentfulLiveUpdates<PageHomeFeaturesFieldsFragment>(featuresData, {
    skip: !preview,
    locale,
  });

  const currentFeatures = liveFeatures ?? featuresData;
  if (!currentFeatures) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentFeatures.sys.id,
    locale,
  });

  // Extract features array once
  const features = currentFeatures.featuresCollection?.items ?? [];

  // Render list of features
  const renderFeatures = () =>
    features
      .filter((f): f is NonNullable<typeof f> => !!f && f.__typename === "ComponentFeature")
      .map((feature) => {
        const featureInspectorProps = useContentfulInspectorMode({
          entryId: feature.sys.id,
          locale,
        });

        return (
          <div key={feature.sys.id} className="flex items-start space-x-4">
            {/* Icon */}
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center"
              {...featureInspectorProps({ fieldId: "icon" })}
            >
              {feature.icon?.url && (
                <Image
                  src={feature.icon.url}
                  alt={feature.icon.title ?? "Feature icon"}
                  width={96}
                  height={96}
                />
              )}
            </div>

            {/* Text content */}
            <div>
              <h3
                className="text-lg font-semibold text-white"
                {...featureInspectorProps({ fieldId: "title" })}
              >
                {feature.title}
              </h3>

              <p className="mt-1 text-gray-300" {...featureInspectorProps({ fieldId: "subtitle" })}>
                {feature.subtitle}
              </p>
            </div>
          </div>
        );
      });

  return (
    <div className="bg-white py-24">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="bg-primary relative isolate overflow-hidden px-6 py-20 sm:rounded-3xl sm:px-10 sm:py-24 lg:py-24 xl:px-24">
          {/* GRID: text left / image right */}
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-center lg:gap-y-0">
            {/* LEFT COLUMN */}
            <div className="lg:row-start-2 lg:max-w-md">
              {/* Title */}
              <h2
                className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                {...inspectorProps({ fieldId: "title" })}
              >
                {currentFeatures.title}
              </h2>

              {/* Subtitle */}
              {currentFeatures.subtitle && (
                <p
                  className="mt-6 text-lg text-gray-300"
                  {...inspectorProps({ fieldId: "subtitle" })}
                >
                  {currentFeatures.subtitle}
                </p>
              )}
            </div>

            {/* RIGHT BIG IMAGE */}
            {currentFeatures.image?.url && (
              <Image
                src={currentFeatures.image.url}
                alt={currentFeatures.image.title ?? "Product feature screenshot"}
                width={600}
                height={600}
                className="lg:w-5xl relative -z-20 min-w-full max-w-xl rounded-xl shadow-xl ring-1 ring-white/10 lg:row-span-4 lg:max-w-none"
                {...inspectorProps({ fieldId: "image" })}
              />
            )}

            {/* FEATURES LIST */}
            <div
              className="max-w-xl lg:row-start-3 lg:mt-10 lg:max-w-md lg:border-t lg:border-white/10 lg:pt-10"
              {...inspectorProps({ fieldId: "features" })}
            >
              <dl className="max-w-xl space-y-8 text-base text-gray-300 lg:max-w-none">
                {renderFeatures()}
              </dl>
            </div>
          </div>

          {/* Template decorative blob */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-12 top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-3xl lg:-bottom-48 lg:top-auto lg:translate-y-0"
          >
            <div
              className="from-secondary to-tertiary aspect-[1155/678] w-[72rem] bg-gradient-to-tr opacity-25"
              style={{
                clipPath:
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
