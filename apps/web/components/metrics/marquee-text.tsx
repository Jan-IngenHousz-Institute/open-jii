"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
}

/**
 * One line of text that scrolls its own overflow into view while hovered. A
 * card's figure slot is a single line, and a name cut off at the ellipsis
 * tells the reader nothing about which resource it names.
 */
export function MarqueeText({ text, className }: MarqueeTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const content = textRef.current;
    if (container === null || content === null) {
      return;
    }

    // The measured copy carries no padding, so its width does not move when the
    // second copy appears and the result cannot oscillate.
    const measure = () => setOverflows(content.offsetWidth > container.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [text]);

  const renderSpacer = () => <span aria-hidden className="w-8 shrink-0" />;

  return (
    <span
      ref={containerRef}
      className={cn(
        "group/marquee block overflow-hidden whitespace-nowrap",
        // Fades the cut edge, which says "there is more" without an ellipsis
        // the animation would have to scroll past.
        overflows && "[mask-image:linear-gradient(to_right,black_85%,transparent)]",
        className,
      )}
    >
      <span
        className={cn("flex w-max", overflows && "motion-safe:group-hover/marquee:animate-marquee")}
      >
        <span ref={textRef}>{text}</span>
        {overflows ? (
          <>
            {renderSpacer()}
            <span aria-hidden>{text}</span>
            {renderSpacer()}
          </>
        ) : null}
      </span>
    </span>
  );
}
