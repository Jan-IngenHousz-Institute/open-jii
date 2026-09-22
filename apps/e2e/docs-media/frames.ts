export interface Frame {
  /** Browser viewport the product is rendered at, in CSS pixels. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** Density the still is rendered at. Desktop renders 1:1 with the published frame. */
  readonly deviceScaleFactor: number;
  /** Published still width. Height follows from the viewport ratio. */
  readonly publishedWidth: number;
}

/**
 * Documentation media must show recognizable desktop product geometry. A 1440
 * or 1120 viewport renders the application at proportions readers recognize as
 * a small tablet, so there is one landscape class and it is a real desktop:
 * 1920 x 1200 (16:10), rendered and published 1:1. Never upscale a narrower
 * viewport to reach it; re-render at 1920 instead.
 *
 * Dialogs and other detail states use this same viewport. Frame them by driving
 * the product UI, not by shrinking the browser.
 */
export const FRAMES = {
  desktop: {
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 1,
    publishedWidth: 1920,
  },
  /** Only for documentation that explicitly teaches tablet behaviour. */
  tablet: {
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    publishedWidth: 1536,
  },
  /** Only for documentation that explicitly teaches phone behaviour. */
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    publishedWidth: 1080,
  },
} as const satisfies Record<string, Frame>;

export type FrameName = keyof typeof FRAMES;

/** The one landscape frame every desktop capture must land on. */
export const DESKTOP_FRAME = { height: 1200, width: 1920 } as const;
