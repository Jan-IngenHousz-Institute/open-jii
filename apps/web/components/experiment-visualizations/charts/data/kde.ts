// 200 evaluation points across the value range gives a visually
// continuous curve at any reasonable display width without making the
// kernel sum (an O(n × m) loop where n=values, m=points) noticeable
// even on tens of thousands of rows. Shared between density-plot
// (single curve) and ridge-plot (one curve per category).
const KDE_SAMPLE_POINTS = 200;
// Padding the sampled range past the data extremes by 2 bandwidths
// keeps the curve from cutting off mid-tail. Below that the visible
// PDF goes to ~5 % of peak; further out is wasted samples.
const KDE_RANGE_PADDING_BW = 2;

export interface KDEResult {
  xs: number[];
  ys: number[];
  bandwidth: number;
}

/**
 * Gaussian kernel density estimate (pure-JS). Bandwidth auto-picked via
 * Silverman's rule. Optionally accepts a fixed `[rangeStart, rangeEnd]`
 * so multiple curves can share an X grid. `cumulative=true` integrates
 * the PDF into a CDF via trapezoidal accumulation.
 */
export function computeKDE(
  values: number[],
  cumulative = false,
  fixedRange?: [number, number],
): KDEResult {
  const n = values.length;
  if (n === 0) {
    return { xs: [], ys: [], bandwidth: 0 };
  }

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  // Silverman's rule of thumb. Falls back to a tiny non-zero h when
  // the data is constant (std=0) so the kernel sum doesn't divide by
  // zero; the resulting curve is a delta-like spike on the value.
  const bandwidth = Math.max(1.06 * std * Math.pow(n, -1 / 5), 1e-9);

  let rangeStart: number;
  let rangeEnd: number;
  if (fixedRange) {
    [rangeStart, rangeEnd] = fixedRange;
  } else {
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = bandwidth * KDE_RANGE_PADDING_BW;
    rangeStart = minVal - padding;
    rangeEnd = maxVal + padding;
  }
  const step = (rangeEnd - rangeStart) / (KDE_SAMPLE_POINTS - 1);

  const xs: number[] = [];
  const pdf: number[] = [];
  const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < KDE_SAMPLE_POINTS; i++) {
    const x = rangeStart + i * step;
    let kSum = 0;
    for (let j = 0; j < n; j++) {
      const u = (x - values[j]) / bandwidth;
      kSum += Math.exp(-(u * u) / 2);
    }
    xs.push(x);
    pdf.push(kSum * norm);
  }

  if (!cumulative) {
    return { xs, ys: pdf, bandwidth };
  }

  // Trapezoidal integration of the PDF gives the CDF on the same grid.
  // The result asymptotes to ~1 at the right edge for well-supported
  // distributions; minor under/overshoot from finite sampling is
  // visually invisible at 200 points.
  const ys: number[] = new Array<number>(KDE_SAMPLE_POINTS);
  ys[0] = 0;
  for (let i = 1; i < KDE_SAMPLE_POINTS; i++) {
    ys[i] = ys[i - 1] + ((pdf[i] + pdf[i - 1]) / 2) * step;
  }
  return { xs, ys, bandwidth };
}
