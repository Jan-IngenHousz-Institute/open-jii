import type { ImageProps as NextImageProps } from "next/image";
import NextImage from "next/image";

import type { ImageFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import { cn } from "@repo/ui/lib/utils";

interface ImageProps extends Omit<ImageFieldsFragment, "__typename"> {
  nextImageProps?: Omit<NextImageProps, "src" | "alt">;
}

export const CtfImage = ({ url, width, height, title, nextImageProps }: ImageProps) => {
  if (!url || !width || !height) return null;

  const blurURL = new URL(url);
  blurURL.searchParams.set("w", "10");

  return (
    <NextImage
      src={url}
      width={width}
      height={height}
      alt={title ?? ""}
      sizes="(max-width: 1200px) 100vw, 50vw"
      placeholder="blur"
      blurDataURL={blurURL.toString()}
      {...nextImageProps}
      className={cn(nextImageProps?.className, "transition-all")}
    />
  );
};
