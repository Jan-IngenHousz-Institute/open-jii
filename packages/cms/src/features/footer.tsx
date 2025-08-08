"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import Link from "next/link";
import React from "react";

import type { FooterFieldsFragment, ButtonFieldsFragment } from "../lib/__generated/sdk";

interface HomeFooterProps {
  footerData: FooterFieldsFragment;
  preview: boolean;
  locale: string;
}

export const HomeFooter: React.FC<HomeFooterProps> = ({ footerData, preview, locale }) => {
  const liveFooter = useContentfulLiveUpdates<FooterFieldsFragment>(footerData, {
    skip: !preview,
    locale,
  });

  const currentFooter = liveFooter || footerData;

  // Early return if no footer data
  if (!currentFooter) return null;

  const inspectorProps = useContentfulInspectorMode({
    entryId: currentFooter.sys.id,
    locale,
  });

  const menuButtons = currentFooter.menuButtonsCollection?.items ?? [];
  const supportButtons = currentFooter.supportButtonsCollection?.items ?? [];

  // Helper function to build href with locale
  const buildHref = (url: string): string => {
    if (url.startsWith("http")) return url;
    return locale ? `/${locale}${url}` : url;
  };

  // Render button list helper
  const renderButtonList = (buttons: (ButtonFieldsFragment | null)[]) => (
    <ul className="space-y-3 text-center text-sm text-white md:text-left">
      {buttons.map((button, idx) => {
        if (!button?.label || !button.url) return null;
        const buttonInspectorProps = useContentfulInspectorMode({
          entryId: button.sys?.id,
          locale,
        });

        return (
          <li key={`${button.url}-${idx}`} {...buttonInspectorProps({ fieldId: "label" })}>
            <Link
              href={buildHref(button.url)}
              className="hover:text-jii-medium-green transition-colors"
            >
              {button.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <footer className="bg-jii-dark-green w-full py-12 text-white">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* OpenJII Brand/Description aligned left */}
          <div className="flex flex-col items-start">
            <div className="mb-6 flex items-center space-x-2">
              <div className="from-jii-medium-green to-jii-dark-green flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r">
                <span className="text-xl font-bold text-white">J</span>
              </div>
              <span className="text-2xl font-bold" {...inspectorProps({ fieldId: "brand" })}>
                {currentFooter.brand}
              </span>
            </div>
            <p
              className="mb-4 leading-relaxed text-white"
              {...inspectorProps({ fieldId: "title" })}
            >
              {currentFooter.title}
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-white" {...inspectorProps({ fieldId: "badge" })}>
                {currentFooter.badge}
              </span>
            </div>
          </div>

          {/* Centered Menu and Support aligned right */}
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-24">
            <div>
              <h4
                className="text-jii-bright-green mb-2 text-center font-bold md:text-left"
                {...inspectorProps({ fieldId: "menuTitle" })}
              >
                {currentFooter.menuTitle}
              </h4>
              {renderButtonList(menuButtons)}
            </div>

            <div>
              <h4
                className="text-jii-bright-green mb-2 text-center font-bold md:text-left"
                {...inspectorProps({ fieldId: "supportTitle" })}
              >
                {currentFooter.supportTitle}
              </h4>
              {renderButtonList(supportButtons)}
            </div>
          </div>
        </div>

        <div className="w-full border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-white" {...inspectorProps({ fieldId: "copyright" })}>
            {currentFooter.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
};
