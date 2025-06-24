"use client";

import { useContentfulInspectorMode } from "@contentful/live-preview/react";
import type { ReactElement } from "react";

import { cn } from "@repo/ui/lib/utils";

import type { ComponentRichImage } from "../../lib/__generated/sdk";
import { CtfImage } from "../contentful";

interface ArticleImageProps {
  image: ComponentRichImage;
}

export const ArticleImage = ({
  image,
}: ArticleImageProps): ReactElement | null => {
  const inspectorProps = useContentfulInspectorMode({ entryId: image.sys.id });
  return image.image ? (
    <figure>
      <div
        className="flex justify-center"
        {...inspectorProps({ fieldId: "image" })}
      >
        <CtfImage
          nextImageProps={{
            className: cn(
              "mt-0 mb-0 ",
              image.fullWidth
                ? "md:w-screen md:max-w-[calc(100vw-40px)] md:shrink-0"
                : "rounded-2xl border border-gray300 shadow-lg",
            ),
          }}
          {...image.image}
        />
      </div>
      {image.caption && (
        <figcaption
          className="mt-4"
          {...inspectorProps({ fieldId: "caption" })}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  ) : null;
};
