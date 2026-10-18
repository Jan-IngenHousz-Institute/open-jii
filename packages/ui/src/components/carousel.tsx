"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import useEmblaCarousel from "embla-carousel-react";
import type { UseEmblaCarouselType } from "embla-carousel-react";
import { Pause, Play } from "lucide-react";
import * as React from "react";

import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";
import { useRotation } from "../hooks/use-rotation";
import { cn } from "../lib/utils";
import { Button } from "./button";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

interface CarouselProps {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
  /**
   * Moves to the next slide this often, in milliseconds, holding while a mouse is over the
   * carousel or focus is inside it. Pair it with `CarouselRotationToggle`, so the reader can
   * stop it, and with `CarouselDots`; place both inside the carousel.
   */
  rotateEvery?: number;
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  /** The slide in view, by index. */
  selected: number;
  slideCount: number;
  /** Present only for a carousel given `rotateEvery`, whether running or paused. */
  rotation: ReturnType<typeof useRotation> | null;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      rotateEvery,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);
    const [selected, setSelected] = React.useState(0);
    const [slideCount, setSlideCount] = React.useState(0);
    // For a reader who asked for less motion, slides change without sliding.
    const prefersReducedMotion = usePrefersReducedMotion();

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
      setSelected(api.selectedScrollSnap());
      setSlideCount(api.scrollSnapList().length);
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev(prefersReducedMotion);
    }, [api, prefersReducedMotion]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext(prefersReducedMotion);
    }, [api, prefersReducedMotion]);

    const scrollTo = React.useCallback(
      (index: number) => {
        api?.scrollTo(index, prefersReducedMotion);
      },
      [api, prefersReducedMotion],
    );

    // Without `loop` the last slide has no next one, so rotation starts over.
    const showNextOrFirst = () => {
      if (api?.canScrollNext()) {
        scrollNext();
      } else {
        scrollTo(0);
      }
    };

    const isRotatable = rotateEvery !== undefined;
    const rotation = useRotation({
      intervalMs: rotateEvery ?? 0,
      onAdvance: showNextOrFirst,
      position: selected,
      canRotate: isRotatable && slideCount > 1,
    });

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      return () => {
        api.off("reInit", onSelect);
        api.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          scrollTo,
          canScrollPrev,
          canScrollNext,
          selected,
          slideCount,
          rotation: isRotatable ? rotation : null,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...(isRotatable ? rotation.holdHandlers : {})}
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation, rotation } = useCarousel();
    // A slide revealed while rotating would talk over the reader; once held or paused, it is read.
    const live = rotation === null ? undefined : rotation.isRotating ? "off" : "polite";

    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          aria-live={live}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The slide's place, for a carousel that shows one slide at a time: slides out of view are
   * then kept from screen readers and Tab, so neither meets a slide nobody can see.
   */
  index?: number;
}

const CarouselItem = React.forwardRef<HTMLDivElement, CarouselItemProps>(
  ({ className, index, ...props }, ref) => {
    const { orientation, selected } = useCarousel();
    const isOutOfView = index !== undefined && index !== selected;

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        aria-hidden={isOutOfView || undefined}
        inert={isOutOfView || undefined}
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute size-8 rounded-full",
          orientation === "horizontal"
            ? "-left-12 top-1/2 -translate-y-1/2"
            : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        {...props}
      >
        <ArrowLeftIcon className="size-4" />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute size-8 rounded-full",
          orientation === "horizontal"
            ? "-right-12 top-1/2 -translate-y-1/2"
            : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollNext}
        onClick={scrollNext}
        {...props}
      >
        <ArrowRightIcon className="size-4" />
        <span className="sr-only">Next slide</span>
      </Button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

interface CarouselDotsProps {
  /** One per slide: what each dot is called, such as "Show daily average". */
  labels: string[];
  className?: string;
}

/** A dot per slide that shows it, drawn small inside a full 24 pixel target. */
function CarouselDots({ labels, className }: CarouselDotsProps) {
  const { selected, scrollTo } = useCarousel();

  const renderDot = (label: string, index: number) => {
    const isSelected = index === selected;
    const show = () => scrollTo(index);

    return (
      <button
        // Dots stand for places, not for what is in them.
        key={index}
        type="button"
        onClick={show}
        aria-label={label}
        aria-current={isSelected}
        className="grid size-6 place-items-center"
      >
        <span
          className={cn(
            "h-1.5 rounded-full transition-all",
            isSelected ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5",
          )}
        />
      </button>
    );
  };

  return <div className={cn("flex items-center", className)}>{labels.map(renderDot)}</div>;
}

interface CarouselRotationToggleProps {
  pauseLabel: string;
  resumeLabel: string;
  className?: string;
}

/** Stops and restarts a rotating carousel; renders nothing for one that does not rotate. */
function CarouselRotationToggle({
  pauseLabel,
  resumeLabel,
  className,
}: CarouselRotationToggleProps) {
  const { rotation } = useCarousel();

  if (rotation === null) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={rotation.toggleRunning}
      aria-label={rotation.isRunning ? pauseLabel : resumeLabel}
      className={cn("text-muted-foreground", className)}
    >
      {rotation.isRunning ? <Pause /> : <Play />}
    </Button>
  );
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  CarouselDots,
  CarouselRotationToggle,
};
