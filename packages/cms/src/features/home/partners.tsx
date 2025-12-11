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
  preview: boolean;
  locale: string;
}

export const HomePartners: React.FC<HomePartnersProps> = ({ partnersData, preview, locale }) => {
  const livePartners = useContentfulLiveUpdates<PageHomePartnersFieldsFragment>(partnersData, {
    skip: !preview,
    locale,
  });

  const currentPartners = livePartners ?? partnersData;
  if (!currentPartners) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentPartners.sys.id,
    locale,
  });

  const rawItems = currentPartners.partnersCollection?.items ?? [];
  const items = rawItems.filter(
    (partner): partner is PartnerFieldsFragment =>
      !!partner && partner.__typename === "ComponentPartner",
  );

  return (
    <section className="mx-auto mt-8 max-w-7xl px-6 sm:mt-10 lg:px-8">
      {items.length > 0 && (
        <div
          className="mx-auto grid w-full items-center"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          {...inspectorProps({ fieldId: "partners" })}
        >
          {items.map((partner) => {
            const partnerInspectorProps = useContentfulInspectorMode({
              entryId: partner.sys.id,
              locale,
            });

            if (!partner.logo?.url) return null;

            return (
              <div
                key={partner.sys.id}
                className="flex justify-center first:justify-start last:justify-end"
              >
                <Image
                  src={partner.logo.url}
                  alt={partner.logo.title ?? "Partner logo"}
                  width={200}
                  height={40}
                  className="h-20 w-auto object-contain"
                  {...partnerInspectorProps({ fieldId: "logo" })}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
