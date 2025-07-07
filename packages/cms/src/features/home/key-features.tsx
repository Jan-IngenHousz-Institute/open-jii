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
  const currentFeatures = liveFeatures || featuresData;

  if (!currentFeatures) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentFeatures?.sys?.id,
    locale,
  });

  // Extract features array once
  const features = currentFeatures.featuresCollection?.items || [];

  // Helper to render the features list
  const renderFeaturesList = (featuresArr: typeof features) =>
    featuresArr
      .filter(
        (feature): feature is NonNullable<typeof feature> =>
          !!feature && feature.__typename === "ComponentFeature",
      )
      .map((feature) => {
        const featureInspectorProps = useContentfulInspectorMode({
          entryId: feature.sys.id,
          locale,
        });
        return (
          <div
            key={feature.sys.id}
            className="border-jii-light-blue hover:border-jii-dark-green hover:bg-jii-light-green/40 before:bg-gradient-radial before:from-jii-light-blue/40 group relative overflow-hidden rounded-3xl border bg-white/90 p-8 shadow-xl backdrop-blur-sm transition-colors duration-200 before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"
          >
            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"
                  {...featureInspectorProps({ fieldId: "icon" })}
                >
                  {feature.icon?.url ? (
                    <Image
                      src={feature.icon.url}
                      alt={feature.icon.title || "Feature icon"}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <span className="h-8 w-8" />
                  )}
                </div>
                <h2
                  className="m-0 text-2xl font-bold text-gray-800"
                  {...featureInspectorProps({ fieldId: "title" })}
                >
                  {feature.title}
                </h2>
              </div>
              <p
                className="leading-relaxed text-gray-600"
                {...featureInspectorProps({ fieldId: "subtitle" })}
              >
                {feature.subtitle}
              </p>
            </div>
          </div>
        );
      });

  return (
    <section className="w-full max-w-7xl px-4 py-20">
      <div className="mb-16 text-center">
        <h2
          className="from-jii-medium-green to-jii-dark-green mb-4 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent"
          {...inspectorProps({ fieldId: "title" })}
        >
          {currentFeatures.title}
        </h2>
        {currentFeatures.subtitle && (
          <p
            className="mx-auto max-w-3xl text-xl text-gray-600"
            {...inspectorProps({ fieldId: "subtitle" })}
          >
            {currentFeatures.subtitle}
          </p>
        )}
      </div>

      <div
        className="grid w-full grid-cols-1 gap-8 md:grid-cols-2"
        {...inspectorProps({ fieldId: `features` })}
      >
        {renderFeaturesList(features)}
      </div>
    </section>
  );
};
