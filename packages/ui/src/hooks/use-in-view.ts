import { useEffect, useRef, useState } from "react";

interface UseInViewOptions extends IntersectionObserverInit {
  /**
   * Once `true`, stop observing and stay `true`. Suits "lazy mount on
   * first scroll-into-view" cases where you don't want the flag to flip
   * back when the element scrolls back out. Defaults to `true`.
   */
  once?: boolean;
}

/**
 * Returns a ref + boolean for "is this element currently in view".
 * Falls back to `true` immediately when `IntersectionObserver` isn't
 * available (SSR / very old browsers) so consumers don't need their
 * own bypass.
 *
 * Typical use: lazy-mount expensive subtrees once they scroll near the
 * viewport.
 *
 * ```tsx
 * const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "200px" });
 * return <div ref={ref}>{inView ? <Heavy /> : null}</div>;
 * ```
 */
export function useInView<T extends Element>(options: UseInViewOptions = {}) {
  const { once = true, root, rootMargin, threshold } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((e) => e.isIntersecting);
        setInView(isIntersecting);
        if (isIntersecting && once) obs.disconnect();
      },
      { root, rootMargin, threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [once, root, rootMargin, threshold]);

  return [ref, inView] as const;
}
