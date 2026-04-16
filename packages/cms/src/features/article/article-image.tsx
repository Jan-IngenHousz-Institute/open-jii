"use client";

import { useContentfulInspectorMode } from "@contentful/live-preview/react";
import type { ReactElement } from "react";

import { cn, cva } from "@repo/ui/lib/utils";

import type { ComponentRichImage } from "../../lib/__generated/sdk";
import { CtfImage } from "../contentful";

interface ArticleImageProps {
  image: ComponentRichImage;
  imageClassName?: string;
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

const imageVariants = cva("rounded-2xl", {
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

export const ArticleImage = ({ image, imageClassName }: ArticleImageProps): ReactElement | null => {
  const inspectorProps = useContentfulInspectorMode({
    entryId: image.sys.id,
  });

  if (!image.image) return null;

  return (
    <figure>
      <div
        className={wrapperVariants({ fullWidth: image.fullWidth })}
        {...inspectorProps({ fieldId: "image" })}
      >
        <CtfImage
          nextImageProps={{
            className: cn(imageVariants({ fullWidth: image.fullWidth }), imageClassName),
          }}
          {...image.image}
        />
      </div>
      {image.caption && (
        <figcaption className="mt-4" {...inspectorProps({ fieldId: "caption" })}>
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
};
