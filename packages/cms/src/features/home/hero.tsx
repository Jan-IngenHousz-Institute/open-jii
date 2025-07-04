"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { PageHomeHeroFieldsFragment } from "../../lib/__generated/sdk";

interface HomeHeroProps {
  heroData: PageHomeHeroFieldsFragment | undefined;
  preview?: boolean;
  locale?: string;
}

export const HomeHero: React.FC<HomeHeroProps> = ({ heroData, preview = false, locale }) => {
  if (!heroData) return null;
  // Enable live updates only in preview mode
  const liveHero = useContentfulLiveUpdates<PageHomeHeroFieldsFragment>(heroData, {
    skip: !preview,
    ...(locale ? { locale } : {}),
  });
  const currentHero = liveHero || heroData;
  const inspectorProps = useContentfulInspectorMode({
    entryId: currentHero?.sys?.id,
    ...(locale ? { locale } : {}),
  });
  if (!currentHero) return null;
  return (
    <section className="relative w-full max-w-7xl px-4 py-20 text-center">
      <div
        className="mb-7 inline-flex items-center space-x-2 rounded-full border border-emerald-200/50 bg-white/40 px-5 py-2.5 backdrop-blur-sm"
        {...(preview ? inspectorProps({ fieldId: "badge" }) : {})}
      >
        <span className="text-sm font-medium text-gray-700">{currentHero.badge}</span>
      </div>
      <h1
        className="text-jii-dark-green mb-5 text-5xl font-extrabold leading-tight md:text-6xl"
        {...(preview ? inspectorProps({ fieldId: "title" }) : {})}
      >
        {currentHero.title}
      </h1>
      <p
        className="mx-auto mb-7 max-w-3xl text-xl leading-relaxed text-gray-600 md:text-2xl"
        {...(preview ? inspectorProps({ fieldId: "subtitle" }) : {})}
      >
        {currentHero.subtitle}
      </p>
      <div className="mb-10 mt-10 flex flex-col justify-center gap-5 sm:flex-row">
        {currentHero.buttonsCollection?.items
          ?.filter(
            (button): button is { label: string; url: string } =>
              typeof button === "object" &&
              button !== null &&
              "label" in button &&
              "url" in button &&
              typeof (button as any).label === "string" &&
              typeof (button as any).url === "string",
          )
          .map((button, idx) => {
            // First button: filled, others: outlined
            const isPrimary = idx === 0;
            const href = button.url.startsWith("http")
              ? button.url
              : locale
                ? `/${locale}${button.url}`
                : button.url;
            return (
              <Link
                key={button.url + idx}
                href={href}
                className={isPrimary ? "sm:h-14" : "sm:h-14"}
                target={button.url.startsWith("http") ? "_blank" : undefined}
                rel={button.url.startsWith("http") ? "noopener noreferrer" : undefined}
                {...(preview ? inspectorProps({ fieldId: `buttonsCollection.items[${idx}]` }) : {})}
              >
                {isPrimary ? (
                  <button className="bg-jii-dark-green hover:bg-jii-medium-green hover:shadow-jii-bright-green/25 group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl px-7 py-3 text-lg font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className="relative flex items-center space-x-2">
                      <span>{button.label}</span>
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </button>
                ) : (
                  <div className="border-jii-dark-green text-jii-dark-green hover:border-jii-medium-green hover:text-jii-medium-green group flex h-14 items-center justify-center rounded-2xl border-2 bg-white px-7 py-3 text-lg font-bold shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-105">
                    <div className="flex items-center space-x-2">
                      <span>{button.label}</span>
                      <ExternalLink className="h-5 w-5 transition-transform group-hover:scale-110" />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
      </div>
    </section>
  );
};
