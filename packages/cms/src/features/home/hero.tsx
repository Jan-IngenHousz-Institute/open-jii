"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { Button } from "@repo/ui/components/button";

import type { PageHomeHeroFieldsFragment, ButtonFieldsFragment } from "../../lib/__generated/sdk";

interface HomeHeroProps {
  heroData: PageHomeHeroFieldsFragment;
  preview: boolean;
  locale: string;
}

export const HomeHero: React.FC<HomeHeroProps> = ({ heroData, preview, locale }) => {
  const liveHero = useContentfulLiveUpdates<PageHomeHeroFieldsFragment>(heroData, {
    skip: !preview,
    locale,
  });

  const currentHero = liveHero || heroData;

  // Early return if no hero data
  if (!currentHero) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentHero.sys.id,
    locale,
  });

  // Helper function to build href with locale
  const buildHref = (url: string): string => {
    if (url.startsWith("http")) return url;
    return locale ? `/${locale}${url}` : url;
  };

  const isExternalUrl = (url: string): boolean => url.startsWith("http");

  // Button component for cleaner JSX
  const renderButton = (button: ButtonFieldsFragment | null) => {
    if (!button?.url) return null;

    const href = buildHref(button.url);
    const isExternal = isExternalUrl(button.url);

    const buttonInspectorProps = useContentfulInspectorMode({
      entryId: button.sys.id,
      locale,
    });

    return (
      <Link
        key={button.sys.id}
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <Button
          variant="secondary"
          className="shadow-xs hover:bg-card group px-5 py-6 font-semibold transition-all duration-300 ease-out hover:scale-[1.03]"
          {...buttonInspectorProps({ fieldId: "label" })}
        >
          <div className="flex items-center space-x-2">
            <span>{button.label}</span>
            <ArrowRight className="h-4 w-4 transform transition-transform duration-300 ease-out group-hover:translate-x-1" />
          </div>
        </Button>
      </Link>
    );
  };

  // The scrim darkens the photo identically in both themes, so it and the
  // foregrounds it pairs with are fixed literals rather than theme tokens.
  // eslint-disable-next-line no-restricted-syntax -- fixed neutral photo scrim
  const heroScrim = "bg-gradient-to-b from-black/70 via-black/50 to-transparent";
  // eslint-disable-next-line no-restricted-syntax -- pairs with heroScrim
  const heroForeground = "text-white";
  // eslint-disable-next-line no-restricted-syntax -- pairs with heroScrim
  const heroSubtitle = "text-white/80";
  // eslint-disable-next-line no-restricted-syntax -- pairs with heroScrim
  const heroBadge = "bg-white/10 ring-white/20";

  return (
    <section
      className={`relative isolate -mt-16 min-h-screen w-full overflow-hidden ${heroForeground}`}
    >
      {/* Background image block */}
      <div className="absolute inset-0 -z-10" {...inspectorProps({ fieldId: "image" })}>
        {currentHero.image?.url && (
          <Image
            src={currentHero.image.url}
            alt={currentHero.image.title ?? "Hero background"}
            fill
            priority
            className="object-cover"
          />
        )}

        {/* Black transparent vertical fade */}
        <div className={`absolute inset-0 ${heroScrim}`} />

        {/* Radial center fade */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)",
          }}
        />
      </div>

      {/* Main container */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center text-center">
          {" "}
          {/* Badge */}
          {currentHero.badge && (
            <div
              className={`backdrop-blur-xs mb-6 inline-flex items-center rounded-full px-4 py-1.5 text-sm ring-1 ${heroBadge}`}
              {...inspectorProps({ fieldId: "badge" })}
            >
              {currentHero.badge}
            </div>
          )}
          {/* Title */}
          <h1
            className="text-5xl font-semibold tracking-tight sm:text-7xl"
            {...inspectorProps({ fieldId: "title" })}
          >
            {currentHero.title}
          </h1>
          {/* Subtitle */}
          <p
            className={`mt-6 text-lg font-medium sm:text-xl ${heroSubtitle}`}
            {...inspectorProps({ fieldId: "subtitle" })}
          >
            {currentHero.subtitle}
          </p>
          {/* Buttons */}
          <div
            className="mt-10 flex items-center justify-center gap-x-6"
            {...inspectorProps({ fieldId: "buttons" })}
          >
            {currentHero.buttonsCollection?.items?.[0] &&
              renderButton(currentHero.buttonsCollection.items[0])}
          </div>
        </div>
      </div>

      {/* Bouncing down arrow */}
      <div className="absolute inset-x-0 bottom-8 flex animate-bounce justify-center">
        <ChevronDown className="mx-auto h-8 w-8" />
      </div>
    </section>
  );
};
