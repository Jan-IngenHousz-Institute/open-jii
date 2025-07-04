"use client";

import { ContentfulLivePreviewInitConfig } from "@contentful/live-preview";
import { ContentfulLivePreviewProvider } from "@contentful/live-preview/react";
import type { PropsWithChildren } from "react";

export const ContentfulPreviewProvider = ({
  children,
  ...props
}: PropsWithChildren<ContentfulLivePreviewInitConfig>) => {
  return <ContentfulLivePreviewProvider {...props}>{children}</ContentfulLivePreviewProvider>;
};
