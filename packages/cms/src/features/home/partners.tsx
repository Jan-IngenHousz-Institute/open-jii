"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import Image from "next/image";
import React from "react";

import type {
  PageHomePartnersFieldsFragment,
  PartnerFieldsFragment,
} from "../../lib/__generated/sdk";

interface HomePartnersProps {
  partnersData: PageHomePartnersFieldsFragment;
  preview?: boolean;
}

export const HomePartners: React.FC<HomePartnersProps> = ({ partnersData, preview = false }) => {
  const livePartners = useContentfulLiveUpdates<PageHomePartnersFieldsFragment>(partnersData, {
    skip: !preview,
  });
  const currentPartners = livePartners || partnersData;
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentPartners?.sys?.id,
  });
  if (!currentPartners) return null;

  // Type guard for ComponentPartner using generated type
  const isComponentPartner = (partner: any): partner is PartnerFieldsFragment =>
    typeof partner === "object" && partner !== null && partner.__typename === "ComponentPartner";
  const rawItems = currentPartners.partnersCollection?.items || [];
  const items = rawItems.filter(isComponentPartner);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20">
      {items.length > 0 && (
        <>
          <h2
            className="text-jii-dark-green mb-4 text-center text-3xl font-bold"
            {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
          >
            {currentPartners.title}
          </h2>
          {currentPartners.subtitle && (
            <p
              className="mx-auto mb-12 w-full max-w-3xl break-words text-center text-gray-500"
              style={{ wordBreak: "break-word" }}
              {...(preview ? inspectorProps({ fieldId: "subtitle" }) : {})}
            >
              {currentPartners.subtitle}
            </p>
          )}
        </>
      )}
      <div className="mb-12 flex w-full flex-wrap justify-center gap-6">
        {items.map((partner, idx) => (
          <div
            key={idx}
            className="flex w-full max-w-xs flex-col items-center rounded-xl border bg-white p-6 transition hover:shadow-md"
            {...(preview ? inspectorProps({ fieldId: `partnersCollection.items[${idx}]` }) : {})}
          >
            {partner.logo && partner.logo.url ? (
              <Image
                src={partner.logo.url}
                alt={partner.logo.title || "Partner logo"}
                width={80}
                height={80}
                className="mb-2 h-20 w-20 object-contain"
              />
            ) : (
              <span className="mb-2 h-20 w-20" />
            )}
            <span className="w-full break-words text-center text-sm text-gray-500">
              {partner.subtitle}
            </span>
          </div>
        ))}
      </div>
      {/* Keep the visual media carousel as is, or make it dynamic if needed */}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
        <div className="relative w-full">
          <div
            className="scrollbar-hide flex gap-4 overflow-x-auto px-1 py-2"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {currentPartners.imagesCollection?.items?.map((img, idx) =>
              img?.url ? (
                <Image
                  key={img.sys?.id || idx}
                  src={img.url}
                  alt={img.title || "Partner visual"}
                  width={900}
                  height={500}
                  className="w-full min-w-[600px] max-w-2xl snap-center rounded-2xl object-cover shadow-sm"
                  priority={idx === 0}
                />
              ) : null,
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
