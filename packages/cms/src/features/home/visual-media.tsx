"use client";

import Image from "next/image";
import React, { useRef, useState } from "react";

interface VisualMediaProps {
  images: Array<{
    url?: string | null;
    title?: string | null;
    sys?: { id?: string | null };
  }>;
  inspectorProps?: (args: any) => any;
}

export const VisualMedia: React.FC<VisualMediaProps> = ({ images, inspectorProps }) => {
  const filteredImages = images?.filter((img) => !!img?.url) || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollToIdx = (idx: number) => {
    setCurrentIdx(idx);
    if (carouselRef.current) {
      const child = carouselRef.current.children[idx] as HTMLElement;
      if (child) {
        let inline: ScrollLogicalPosition = "center";
        if (idx === 0) inline = "start";
        else if (idx === filteredImages.length - 1) inline = "end";
        child.scrollIntoView({ behavior: "smooth", inline, block: "nearest" });
      }
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) scrollToIdx(currentIdx - 1);
  };
  const handleNext = () => {
    if (currentIdx < filteredImages.length - 1) scrollToIdx(currentIdx + 1);
  };

  if (!filteredImages.length) return null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
      <div className="relative w-full overflow-hidden rounded-2xl">
        {/* Carousel controls */}
        {filteredImages.length > 1 && (
          <>
            <button
              aria-label="Previous image"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white disabled:opacity-50"
              disabled={currentIdx === 0}
              style={{ pointerEvents: currentIdx === 0 ? "none" : undefined }}
            >
              <span className="sr-only">Previous</span>
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              aria-label="Next image"
              onClick={handleNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white disabled:opacity-50"
              disabled={currentIdx === filteredImages.length - 1}
              style={{
                pointerEvents: currentIdx === filteredImages.length - 1 ? "none" : undefined,
              }}
            >
              <span className="sr-only">Next</span>
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        {/* Hide scrollbar for all browsers */}
        <style>{`
          .carousel-scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="carousel-scrollbar-hide scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth px-1"
          ref={carouselRef}
          style={{
            scrollSnapType: "x mandatory",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
          {...(inspectorProps ? inspectorProps({ fieldId: `images` }) : {})}
        >
          {filteredImages.map((img, idx) =>
            img?.url ? (
              <div
                key={img.sys?.id || idx}
                className={`flex h-60 w-full min-w-[90vw] max-w-full snap-center items-center rounded-2xl md:h-96 md:min-w-[600px] md:max-w-2xl justify-center${
                  idx === currentIdx ? "ring-jii-dark-green ring-2" : ""
                }`}
                style={{ boxSizing: "border-box" }}
                data-carousel
              >
                <Image
                  src={img.url}
                  alt={img.title || "Partner visual"}
                  width={900}
                  height={400}
                  className="h-full w-full rounded-2xl object-cover shadow-sm"
                  priority={idx === 0}
                  onClick={() => scrollToIdx(idx)}
                  style={{ cursor: "pointer" }}
                />
              </div>
            ) : null,
          )}
        </div>
      </div>
      {/* Pagination dots - moved outside the container */}
      {filteredImages.length > 1 && (
        <div className="mt-4 flex w-full justify-center gap-1">
          {filteredImages.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to image ${idx + 1}`}
              className={`h-2 w-2 rounded-full border-none transition-all ${
                idx === currentIdx ? "bg-jii-dark-green" : "bg-gray-300"
              }`}
              onClick={() => scrollToIdx(idx)}
              style={{ outline: "none" }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
