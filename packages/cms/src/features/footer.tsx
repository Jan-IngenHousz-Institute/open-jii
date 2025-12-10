"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import Image from "next/image";
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
              className="hover:text-jii-bright-green transition-colors"
            >
              {button.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <footer className="bg-sidebar w-full py-12 text-white">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* OpenJII Brand/Description aligned left */}
          <div className="flex flex-col items-start">
            <Image
              src="/openJII-logo-BW-horizontal-white.png"
              alt="OpenJII Logo"
              width={140}
              height={80}
              priority
              className="-ml-2 -mt-3"
            />
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
                className="mb-2 text-center font-extrabold md:text-left"
                {...inspectorProps({ fieldId: "menuTitle" })}
              >
                {currentFooter.menuTitle}
              </h4>
              {renderButtonList(menuButtons)}
            </div>

            <div>
              <h4
                className="mb-2 text-center font-extrabold md:text-left"
                {...inspectorProps({ fieldId: "supportTitle" })}
              >
                {currentFooter.supportTitle}
              </h4>
              {renderButtonList(supportButtons)}
            </div>
          </div>
        </div>

        <div className="w-full border-t border-white/40 pt-8 text-center">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <p className="text-sm text-white" {...inspectorProps({ fieldId: "copyright" })}>
              {currentFooter.copyright}
            </p>
            <span className="hidden text-white sm:inline">•</span>
            <Link
              href="https://github.com/Jan-IngenHousz-Institute/open-jii"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-jii-bright-green flex items-center gap-2 text-sm text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
