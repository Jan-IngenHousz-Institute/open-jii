import { cn } from "@repo/ui/lib/utils";

import type { ImageFieldsFragment } from "../../lib/__generated/sdk";

interface VideoProps extends Omit<ImageFieldsFragment, "__typename"> {
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export const CtfVideo = ({
  url,
  title,
  contentType,
  width,
  height,
  className,
  autoPlay = false,
  muted = true,
  loop = false,
  controls = true,
}: VideoProps) => {
  if (!url) return null;

  return (
    <video
      src={url}
      width={width ?? undefined}
      height={height ?? undefined}
      title={title ?? undefined}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline
      preload="metadata"
      className={cn("max-w-full", className)}
    >
      {contentType && <source src={url} type={contentType} />}
      Your browser does not support the video tag.
    </video>
  );
};

/**
 * Check if an asset's contentType indicates it is a video.
 */
export const isVideoAsset = (contentType?: string | null): boolean =>
  !!contentType?.startsWith("video/");
