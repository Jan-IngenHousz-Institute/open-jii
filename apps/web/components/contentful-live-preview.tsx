"use client";

import dynamic from "next/dynamic";

/** The live-preview SDK, loaded only for an editor in preview mode rather than on every page. */
export const ContentfulLivePreview = dynamic(() =>
  import("@repo/cms/contentful").then((module) => module.ContentfulPreviewProvider),
);
