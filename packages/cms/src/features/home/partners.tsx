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
  ImageFieldsFragment,
} from "../../lib/__generated/sdk";
import { VisualMedia } from "./visual-media";

interface HomePartnersProps {
  partnersData: PageHomePartnersFieldsFragment;
  preview: boolean;
  locale: string;
}

export const HomePartners: React.FC<HomePartnersProps> = ({ partnersData, preview, locale }) => {
  const livePartners = useContentfulLiveUpdates<PageHomePartnersFieldsFragment>(partnersData, {
    skip: !preview,
    locale,
  });
  const currentPartners = livePartners || partnersData;

  if (!currentPartners) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentPartners?.sys?.id,
    locale,
  });

  // Type guard
  const rawItems = currentPartners.partnersCollection?.items ?? [];
  const items = rawItems.filter(
    (partner): partner is PartnerFieldsFragment =>
      !!partner && partner.__typename === "ComponentPartner",
  );

  // Visual media images
  const images =
    currentPartners.imagesCollection?.items?.filter(
      (img): img is ImageFieldsFragment => !!img && img.__typename === "Asset",
    ) ?? [];

  // Helper to render the partners list
  const renderPartnersList = (partners: PartnerFieldsFragment[]) =>
    partners.map((partner) => {
      const partnerInspectorProps = useContentfulInspectorMode({
        entryId: partner.sys.id,
        locale,
      });
      return (
        <div
          key={partner.sys.id}
          className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-gray-200 bg-gray-50 p-8 shadow-sm transition-colors duration-200 hover:bg-white hover:shadow-md"
        >
          {/* Removed gradient overlay and backdrop-blur for performance */}
          {partner.logo && partner.logo.url ? (
            <div
              className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-inner"
              {...partnerInspectorProps({ fieldId: "logo" })}
            >
              <Image
                src={partner.logo.url}
                alt={partner.logo.title || "Partner logo"}
                width={80}
                height={80}
                className="h-20 w-20 object-contain"
              />
            </div>
          ) : (
            <span className="mb-4 h-24 w-24 rounded-full bg-gray-100" />
          )}
          <span
            className="mb-1 w-full break-words text-center text-base font-medium text-gray-700"
            {...partnerInspectorProps({ fieldId: "subtitle" })}
          >
            {partner.subtitle}
          </span>
        </div>
      );
    });

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20">
      {items.length > 0 && (
        <>
          <h2
            className="from-jii-medium-green to-jii-dark-green mb-4 bg-gradient-to-r bg-clip-text text-center text-4xl font-bold text-transparent"
            {...inspectorProps({ fieldId: "title" })}
          >
            {currentPartners.title}
          </h2>
          {currentPartners.subtitle && (
            <p
              className="mx-auto mb-12 max-w-3xl text-center text-xl text-gray-600"
              {...inspectorProps({ fieldId: "subtitle" })}
            >
              {currentPartners.subtitle}
            </p>
          )}
        </>
      )}
      <div
        className="mb-12 flex w-full flex-wrap justify-center gap-6"
        {...inspectorProps({ fieldId: `partners` })}
      >
        {renderPartnersList(items)}
      </div>
      {/* Visual media carousel section */}
      <VisualMedia images={images} inspectorProps={inspectorProps} />
    </section>
  );
};
