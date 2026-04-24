"use client";

import { useContentfulInspectorMode } from "@contentful/live-preview/react";
import type { ReactElement } from "react";

import { cn, cva } from "@repo/ui/lib/utils";

import type { ComponentRichImage } from "../../lib/__generated/sdk";
import { CtfVideo } from "../contentful/ctf-video";

interface ArticleVideoProps {
  video: ComponentRichImage;
  videoClassName?: string;
}

const wrapperVariants = cva("flex", {
  variants: {
    fullWidth: {
      true: "justify-center",
      false: "justify-start",
    },
  },
  defaultVariants: {
    fullWidth: false,
  },
});

const videoVariants = cva("rounded-2xl", {
  variants: {
    fullWidth: {
      true: "md:w-screen md:max-w-[calc(100vw-40px)] md:shrink-0",
      false: "my-4",
    },
  },
  defaultVariants: {
    fullWidth: false,
  },
});

export const ArticleVideo = ({ video, videoClassName }: ArticleVideoProps): ReactElement | null => {
  const inspectorProps = useContentfulInspectorMode({
    entryId: video.sys.id,
  });

  if (!video.image) return null;

  return (
    <figure>
      <div
        className={wrapperVariants({ fullWidth: video.fullWidth })}
        {...inspectorProps({ fieldId: "image" })}
      >
        <CtfVideo
          className={cn(videoVariants({ fullWidth: video.fullWidth }), videoClassName)}
          {...video.image}
        />
      </div>
      {video.caption && (
        <figcaption className="mt-4" {...inspectorProps({ fieldId: "caption" })}>
          {video.caption}
        </figcaption>
      )}
    </figure>
  );
};
